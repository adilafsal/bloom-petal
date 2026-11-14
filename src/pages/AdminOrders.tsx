import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, CalendarDays, Flower2, LayoutDashboard, LoaderCircle, LogOut, Package, Search, Settings, Tags, Truck, Users, X } from "lucide-react";
import { authClient, useAuthSession } from "../lib/auth-client";
import { money } from "../store";
import "../admin-orders.css";

type Order = {
  id: string; order_number: string; created_at: string; subtotal: number; delivery_fee: number; total: number;
  delivery_address: { address?: string; city?: string; area?: string; building?: string; apartment?: string };
  delivery_date: string; delivery_time: string; gift_message: string; payment_method: string; payment_status: string;
  status: string; customer_name: string; customer_email: string; customer_phone: string;
  products: Array<{ product_name: string; quantity: number; unit_price: number; size: string; customization: Record<string, unknown> }>;
  timeline?: Array<{ status: string; changed_at: string }>;
};
type OrdersResponse = { orders: Order[]; total: number; page: number; pageSize: number; pendingCount: number; recentIds: string[] };
const statuses = ["All Orders", "Pending", "Confirmed", "Preparing", "Ready for delivery", "Out for delivery", "Delivered", "Cancelled"];
const orderStatuses = statuses.slice(1);
const nextStatuses: Record<string, string[]> = { Pending: ["Confirmed", "Cancelled"], Confirmed: ["Preparing", "Cancelled"], Preparing: ["Ready for delivery", "Cancelled"], "Ready for delivery": ["Out for delivery", "Cancelled"], "Out for delivery": ["Delivered", "Cancelled"], Delivered: [], Cancelled: [] };
const formatAddress = (address: Order["delivery_address"]) => [address?.address, address?.building, address?.apartment, address?.area, address?.city].filter(Boolean).join(", ");
const formatPayment = (method: string) => method === "cash_on_delivery" ? "Cash on Delivery" : method === "stripe" ? "Online · Stripe" : method;

export default function AdminOrders() {
  const { data, isPending } = useAuthSession();
  const navigate = useNavigate();
  const user = data?.user;
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState("All Orders");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [selected, setSelected] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authFailure, setAuthFailure] = useState("");
  const [verificationNotice, setVerificationNotice] = useState("");
  const [resendingVerification, setResendingVerification] = useState(false);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [updating, setUpdating] = useState(false);
  const [newOrderCount, setNewOrderCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const seenOrderIds = useRef<Set<string> | null>(null);

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (status !== "All Orders") params.set("status", status);
      if (search.trim()) params.set("search", search.trim());
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      const response = await fetch(`/api/admin/orders?${params}`, { credentials: "same-origin" });
      if (response.status === 401 || response.status === 403) {
        const body = await response.json().catch(() => null) as { statusMessage?: string; message?: string } | null;
        const message = body?.statusMessage || body?.message || "Your administrator session could not be verified.";
        setOrders([]);
        if (response.status === 401) setError(message);
        else { setAuthFailure(message); setAuthorized(false); }
        return;
      }
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { statusMessage?: string; message?: string } | null;
        throw new Error(body?.statusMessage || body?.message || "Couldn't load orders from Neon. Please try again.");
      }
      const result = await response.json() as OrdersResponse;
      const latestIds = new Set(result.recentIds);
      if (seenOrderIds.current === null) seenOrderIds.current = latestIds;
      else {
        let incoming = 0;
        latestIds.forEach(id => { if (!seenOrderIds.current?.has(id)) incoming++; });
        if (incoming) setNewOrderCount(count => count + incoming);
        seenOrderIds.current = new Set([...seenOrderIds.current, ...latestIds]);
      }
      setOrders(result.orders);
      setTotal(result.total);
      setPendingCount(result.pendingCount);
      setAuthorized(true);
      setSelected(current => current ? result.orders.find(order => order.id === current.id) ?? null : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load orders from Neon.");
    } finally { if (!silent) setLoading(false); }
  }, [status, search, dateFrom, dateTo, page, navigate]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => { void loadOrders(); }, 180);
    return () => window.clearTimeout(timer);
  }, [user, loadOrders]);
  useEffect(() => {
    if (!user && !isPending) navigate("/auth/sign-in", { replace: true });
  }, [user, isPending, navigate]);
  useEffect(() => {
    if (!user || authorized !== true) return;
    const timer = window.setInterval(() => { void loadOrders(true); }, 15000);
    return () => window.clearInterval(timer);
  }, [user, authorized, loadOrders]);

  const pageCount = Math.max(1, Math.ceil(total / 20));
  const shownFrom = total ? (page - 1) * 20 + 1 : 0;
  const shownTo = Math.min(page * 20, total);
  const stats = useMemo(() => ({ sales: orders.reduce((sum, order) => sum + order.total, 0) }), [orders]);

  async function resendVerificationEmail() {
    setResendingVerification(true);
    setVerificationNotice("");
    try {
      navigate(`/auth/verify-email?email=${encodeURIComponent(user!.email)}&redirectTo=%2Fadmin%2Forders`);
    } catch (failure) {
      setVerificationNotice(failure instanceof Error ? failure.message : "The verification page could not be opened.");
      setResendingVerification(false);
    }
  }

  async function updateStatus(order: Order, nextStatus: string) {
    if (nextStatus === "Cancelled" && !window.confirm(`Cancel order ${order.order_number}? This will be recorded in the order status.`)) return;
    setUpdating(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(order.order_number)}`, {
        method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: nextStatus }),
      });
      if (response.status === 401) throw new Error("Your server session could not be verified. Sign out and sign in again.");
      if (!response.ok) throw new Error(response.status === 403 ? "Administrator access is required." : "Status update failed. Please try again.");
      await loadOrders();
    } catch (e) { setError(e instanceof Error ? e.message : "Status update failed."); }
    finally { setUpdating(false); }
  }

  if (isPending || (!user && !authorized)) return <main className="admin-orders-state"><LoaderCircle className="spin"/><p>Checking administrator session…</p></main>;
  if (!user) return null;
  if (authorized === false) return <main className="admin-orders-state"><span className="eyebrow">ACCESS RESTRICTED</span><h1>Admin access <em>is unavailable.</em></h1><p>{authFailure || "Customer order data remains protected."}</p>{authFailure.toLowerCase().includes("verify this email")&&<><button className="button button-dark" disabled={resendingVerification} onClick={() => void resendVerificationEmail()}>{resendingVerification?"Sending verification…":"Resend verification email"}</button>{verificationNotice&&<p role="status">{verificationNotice}</p>}</>}<button className="button button-outline" onClick={() => authClient.signOut({})}>Sign out <LogOut size={15}/></button></main>;

  return <div className="admin-app"><aside className={`admin-sidebar ${sidebarOpen?"open":""}`}><Link to="/" className="admin-brand"><Flower2 size={21}/><span>Bloom <i>&</i> Petal</span></Link><div className="admin-sidebar-caption">SHOP MANAGEMENT</div><nav className="admin-sidebar-nav"><Link to="/admin" className="admin-nav-link"><LayoutDashboard size={16}/> Dashboard</Link><Link to="/admin/orders" className="admin-nav-link active"><Package size={16}/> Orders{pendingCount>0&&<span className="admin-nav-badge">{pendingCount}</span>}{newOrderCount>0&&<span className="admin-new-dot" title={`${newOrderCount} new orders`}/>}</Link><Link to="/admin/delivery" className="admin-nav-link"><Truck size={16}/> Delivery</Link><span className="admin-nav-link disabled"><Flower2 size={16}/> Products <small>Later</small></span><span className="admin-nav-link disabled"><Tags size={16}/> Categories <small>Later</small></span><span className="admin-nav-link disabled"><Users size={16}/> Customers <small>Later</small></span><Link to="/admin/delivery" className="admin-nav-link"><Settings size={16}/> Store Settings</Link></nav><div className="admin-sidebar-bottom"><div className="admin-user-info"><span className="admin-user-avatar">{(user.name||user.email).slice(0,1).toUpperCase()}</span><span><strong>{user.name||"Store owner"}</strong><small>{user.email}</small></span></div><button className="admin-logout" onClick={() => authClient.signOut({})}><LogOut size={15}/> Logout</button></div></aside>
    {sidebarOpen&&<button className="admin-mobile-scrim" onClick={()=>setSidebarOpen(false)} aria-label="Close navigation"/>}
    <main className="admin-main"><header className="admin-topbar"><button className="admin-mobile-menu" onClick={()=>setSidebarOpen(!sidebarOpen)} aria-label="Open navigation">☰</button><span>Orders</span><button className="admin-refresh" onClick={()=>void loadOrders()} disabled={loading}><ArrowRight size={14}/> Refresh</button></header><div className="admin-content"><div className="admin-page-title"><div><span className="eyebrow">ORDER MANAGEMENT</span><h1>Customer <em>orders.</em></h1><p>Review, filter and update every order placed through your store.</p></div>{newOrderCount>0&&<button className="new-order-alert" onClick={()=>{setNewOrderCount(0);setPage(1);setStatus("All Orders");setSearch("");setDateFrom("");setDateTo("");void loadOrders(true);}}>✦ {newOrderCount} new {newOrderCount===1?"order":"orders"} <X size={14}/></button>}</div>
      <div className="admin-metric-row"><div><span>ORDERS MATCHING FILTERS</span><strong>{total}</strong></div><div><span>PENDING ORDERS</span><strong>{pendingCount}</strong></div><div><span>VALUE ON THIS PAGE</span><strong>{money(stats.sales)}</strong></div></div>
      <section className="admin-orders-panel"><div className="admin-panel-heading"><div><h2>Orders</h2><p>Newest orders appear first · refreshed every 15 seconds</p></div><span className="admin-live-indicator"><i/> Live</span></div>
        <div className="admin-filter-row"><div className="admin-status-filters">{statuses.map(item=><button key={item} onClick={()=>{setStatus(item);setPage(1);}} className={status===item?"active":""}>{item}{item==="Pending"&&pendingCount>0&&<b>{pendingCount}</b>}</button>)}</div><div className="admin-search"><Search size={16}/><input placeholder="Order number, customer or phone" value={search} onChange={event=>{setSearch(event.target.value);setPage(1);}}/>{search&&<button onClick={()=>setSearch("")} aria-label="Clear search"><X size={14}/></button>}</div></div>
        <div className="admin-date-filters"><label><CalendarDays size={14}/> From <input type="date" value={dateFrom} onChange={event=>{setDateFrom(event.target.value);setPage(1);}}/></label><label>To <input type="date" value={dateTo} onChange={event=>{setDateTo(event.target.value);setPage(1);}}/></label>{(dateFrom||dateTo)&&<button onClick={()=>{setDateFrom("");setDateTo("");setPage(1);}}>Clear dates</button>}</div>
        {error&&<div className="admin-error" role="alert">{error}<button onClick={()=>void loadOrders()}>Try again</button></div>}
        {loading?<div className="admin-table-state"><LoaderCircle className="spin"/> Loading orders from Neon…</div>:orders.length===0?<div className="admin-table-state"><Package size={28}/><h3>{search||dateFrom||dateTo||status!=="All Orders"?"No matching orders":"No orders yet"}</h3><p>{search||dateFrom||dateTo||status!=="All Orders"?"Adjust the search or filters and try again.":"New customer orders will appear here as soon as they are placed."}</p></div>:<div className="admin-table-scroll"><table className="admin-orders-table"><thead><tr><th>Order</th><th>Customer</th><th>Order date</th><th>Products</th><th>Total</th><th>Payment</th><th>Payment status</th><th>Order status</th><th/></tr></thead><tbody>{orders.map(order=><tr key={order.id}><td><strong className="order-number">{order.order_number}</strong></td><td><strong>{order.customer_name}</strong><small>{order.customer_phone}</small></td><td>{new Date(order.created_at).toLocaleDateString()}</td><td>{order.products.map(item=>`${item.product_name} × ${item.quantity}`).join(", ")}</td><td><strong>{money(order.total)}</strong></td><td>{formatPayment(order.payment_method)}</td><td><span className={`payment-pill payment-${order.payment_status.toLowerCase().replaceAll(" ","-")}`}>{order.payment_status}</span></td><td><span className={`status-chip status-${order.status.toLowerCase().replaceAll(" ","-")}`}>{order.status}</span></td><td><button className="view-order-button" onClick={()=>setSelected(order)}>View details <ArrowRight size={13}/></button></td></tr>)}</tbody></table></div>}
        <div className="admin-pagination"><span>Showing {shownFrom}–{shownTo} of {total} orders</span><div><button disabled={page<=1||loading} onClick={()=>setPage(current=>Math.max(1,current-1))}>Previous</button><span>Page {page} of {pageCount}</span><button disabled={page>=pageCount||loading} onClick={()=>setPage(current=>Math.min(pageCount,current+1))}>Next</button></div></div>
      </section>
    </div></main>
    {selected&&<div className="order-detail-backdrop" onClick={()=>setSelected(null)}><aside className="order-detail-drawer" onClick={event=>event.stopPropagation()}><div className="order-drawer-header"><div><span className="eyebrow">ORDER DETAILS</span><h2>{selected.order_number}</h2><small>Placed {new Date(selected.created_at).toLocaleString()}</small></div><button onClick={()=>setSelected(null)} aria-label="Close order details"><X/></button></div><label className="order-status-control">Order status<select disabled={updating} value={selected.status} onChange={event=>void updateStatus(selected,event.target.value)}>{orderStatuses.map(item=><option key={item}>{item}</option>)}</select></label><section className="order-detail-section"><h3>Customer</h3><strong>{selected.customer_name}</strong><a href={`tel:${selected.customer_phone}`}>{selected.customer_phone}</a><a href={`mailto:${selected.customer_email}`}>{selected.customer_email}</a><span>{formatAddress(selected.delivery_address)}</span></section><section className="order-detail-section"><h3>Products</h3>{selected.products.map((item,index)=><div className="order-detail-product" key={`${selected.id}-${index}`}><div><strong>{item.product_name}</strong><small>{item.size} · Qty {item.quantity}</small></div><span>{money(item.unit_price*item.quantity)}</span></div>)}</section><section className="order-detail-section delivery-detail"><h3>Delivery</h3><span>{new Date(`${selected.delivery_date}T00:00:00`).toLocaleDateString()} · {selected.delivery_time}</span>{selected.gift_message&&<p><strong>Gift note:</strong> {selected.gift_message}</p>}</section><section className="order-detail-section"><h3>Payment</h3><div className="detail-pair"><span>Method</span><strong>{formatPayment(selected.payment_method)}</strong></div><div className="detail-pair"><span>Status</span><strong>{selected.payment_status}</strong></div></section><section className="order-totals"><div><span>Subtotal</span><strong>{money(selected.subtotal)}</strong></div><div><span>Delivery fee</span><strong>{money(selected.delivery_fee)}</strong></div><div className="final-total"><span>Total</span><strong>{money(selected.total)}</strong></div></section></aside></div>}
  </div>;
}
