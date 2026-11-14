import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, LoaderCircle, LogOut, Search, X } from "lucide-react";
import { Layout } from "../storefront";
import { authClient, useAuthSession } from "../lib/auth-client";
import { money } from "../store";
import "../admin-orders.css";

type Order = {
  id: string; order_number: string; created_at: string; subtotal: number; delivery_fee: number; total: number;
  delivery_address: { address?: string; city?: string; area?: string; building?: string; apartment?: string };
  delivery_date: string; delivery_time: string; gift_message: string; payment_method: string; payment_status: string;
  status: string; customer_name: string; customer_email: string; customer_phone: string;
  products: Array<{ product_name: string; quantity: number; unit_price: number; size: string; customization: Record<string, unknown> }>;
};
const statuses = ["All orders", "Pending", "Confirmed", "Preparing", "Out for Delivery", "Delivered", "Cancelled"];
const allowedStatuses = statuses.slice(1);
const formatAddress = (address: Order["delivery_address"]) => [address?.address, address?.building, address?.apartment, address?.area, address?.city].filter(Boolean).join(", ");

export default function AdminOrders() {
  const { data, isPending } = useAuthSession();
  const navigate = useNavigate();
  const user = data?.user;
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("All orders");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [updating, setUpdating] = useState(false);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filter !== "All orders") params.set("status", filter);
      if (search.trim()) params.set("search", search.trim());
      const response = await fetch(`/api/admin/orders?${params}`, { credentials: "same-origin" });
      if (response.status === 401) { setOrders([]); navigate("/auth/sign-in", { replace: true }); return; }
      if (response.status === 403) { setAuthorized(false); setOrders([]); return; }
      if (!response.ok) throw new Error("Couldn't load orders. Please try again.");
      const result = await response.json() as Order[];
      setOrders(result);
      setAuthorized(true);
      setSelected(current => current ? result.find(order => order.id === current.id) ?? null : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't load orders.");
    } finally { setLoading(false); }
  }, [filter, search, navigate]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => { void loadOrders(); }, 220);
    return () => window.clearTimeout(timer);
  }, [user, loadOrders]);
  useEffect(() => {
    if (!isPending && !user) navigate("/auth/sign-in", { replace: true });
  }, [isPending, user, navigate]);

  const stats = useMemo(() => ({ total: orders.length, pending: orders.filter(o => o.status === "Pending").length, sales: orders.reduce((sum,o)=>sum+o.total,0) }), [orders]);

  async function updateStatus(order: Order, status: string) {
    setUpdating(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(order.order_number)}`, {
        method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }),
      });
      if (response.status === 401) { navigate("/auth/sign-in", { replace: true }); return; }
      if (!response.ok) throw new Error(response.status === 403 ? "Administrator access is required." : "Status update failed. Please try again.");
      await loadOrders();
    } catch (e) { setError(e instanceof Error ? e.message : "Status update failed."); }
    finally { setUpdating(false); }
  }

  if (isPending) return <Layout><main className="admin-orders-state"><LoaderCircle className="spin"/><p>Checking administrator session…</p></main></Layout>;
  if (!user) return <Layout><main className="admin-orders-state"><span className="eyebrow">FLOWER SHOP ADMIN</span><h1>Sign in to <em>manage orders.</em></h1><p>Only authorized store administrators can view customer orders.</p><Link className="button button-dark" to="/auth/sign-in">Administrator sign in <ArrowRight size={15}/></Link></main></Layout>;
  if (authorized === false) return <Layout><main className="admin-orders-state"><span className="eyebrow">ACCESS RESTRICTED</span><h1>This account isn't <em>on the shop team.</em></h1><p>Your account is signed in, but it is not authorized to view customer orders. Ask the store owner to add your email to the server's administrator allowlist.</p><button className="button button-outline" onClick={() => authClient.signOut()}>Sign out <LogOut size={15}/></button></main></Layout>;

  return <Layout><main className="admin-orders-page"><div className="admin-orders-heading"><div><Link to="/" className="admin-back"><ArrowLeft size={14}/> Flower shop</Link><span className="eyebrow">PRIVATE · NEON DATABASE</span><h1>Order <em>book.</em></h1><p>Customer orders from the live store database, newest first.</p></div><div className="admin-owner"><span>{user.name || user.email}</span><button onClick={() => authClient.signOut()} title="Sign out" aria-label="Sign out"><LogOut size={15}/></button></div></div>
    <div className="admin-live-stats"><div><span>ORDERS IN VIEW</span><strong>{stats.total}</strong></div><div><span>PENDING</span><strong>{stats.pending}</strong></div><div><span>ORDER VALUE IN VIEW</span><strong>{money(stats.sales)}</strong></div></div>
    <div className="admin-order-controls"><div className="admin-status-filters">{statuses.map(status=><button key={status} onClick={()=>setFilter(status)} className={filter===status?"active":""}>{status}</button>)}</div><label className="admin-search"><Search size={16}/><input placeholder="Search order number or customer" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button onClick={()=>setSearch("")} aria-label="Clear search"><X size={14}/></button>}</label></div>
    {error&&<div className="admin-error" role="alert">{error}<button onClick={()=>void loadOrders()}>Try again</button></div>}
    <div className="admin-order-layout"><section className="admin-order-list" aria-label="Orders">{loading?<div className="admin-inline-state"><LoaderCircle className="spin"/> Loading orders from Neon…</div>:orders.length===0?<div className="admin-inline-state"><span className="empty-bloom">✳</span><h2>No orders to show.</h2><p>{search||filter!=="All orders"?"Try changing your search or status filter.":"New customer orders will appear here."}</p></div>:orders.map(order=><button className={`admin-order-card ${selected?.id===order.id?"selected":""}`} key={order.id} onClick={()=>setSelected(order)}><div className="admin-card-top"><strong>{order.order_number}</strong><span className={`status-chip status-${order.status.toLowerCase().replaceAll(" ","-")}`}>{order.status}</span></div><div className="admin-card-customer">{order.customer_name}</div><div className="admin-card-meta"><span>{new Date(order.created_at).toLocaleString()}</span><strong>{money(order.total)}</strong></div></button>)}</section>
    <aside className="admin-order-detail">{selected?<><div className="admin-detail-top"><div><span className="eyebrow">ORDER DETAILS</span><h2>{selected.order_number}</h2></div><button className="admin-detail-close" onClick={()=>setSelected(null)} aria-label="Close details"><X size={17}/></button></div><p className="admin-detail-date">Placed {new Date(selected.created_at).toLocaleString()}</p><label className="admin-status-select">Order status<select disabled={updating} value={selected.status} onChange={e=>void updateStatus(selected,e.target.value)}>{allowedStatuses.map(status=><option key={status}>{status}</option>)}</select></label><div className="admin-detail-block"><h3>Customer</h3><strong>{selected.customer_name}</strong><a href={`tel:${selected.customer_phone}`}>{selected.customer_phone}</a><a href={`mailto:${selected.customer_email}`}>{selected.customer_email}</a></div><div className="admin-detail-block"><h3>Delivery</h3><span>{formatAddress(selected.delivery_address)}</span><span>{new Date(`${selected.delivery_date}T00:00:00`).toLocaleDateString()} · {selected.delivery_time}</span></div><div className="admin-detail-block"><h3>Flowers</h3>{selected.products.map((item,index)=><div className="admin-detail-product" key={`${selected.id}-${index}`}><span>{item.product_name}<small>{item.size} · Qty {item.quantity}</small></span><strong>{money(item.unit_price*item.quantity)}</strong></div>)}</div>{selected.gift_message&&<div className="admin-detail-block"><h3>Gift message</h3><p>{selected.gift_message}</p></div>}<div className="admin-payment-row"><span>Payment method</span><strong>{selected.payment_method.replaceAll("_"," ")}</strong></div><div className="admin-payment-row"><span>Payment status</span><strong>{selected.payment_status}</strong></div><div className="admin-total-row"><span>Total</span><strong>{money(selected.total)}</strong></div></>:<div className="admin-inline-state admin-detail-empty"><span className="eyebrow">ORDER DETAILS</span><h2>Select an order</h2><p>Choose an order to view its customer, delivery, payment and product details.</p></div>}</aside></div>
  </main></Layout>;
}
