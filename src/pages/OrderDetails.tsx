import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, Check } from "lucide-react";
import { Layout } from "../storefront";
import { money } from "../store";
import "../delivery-admin.css";

type OrderDetail = {
  order_number: string; created_at: string; subtotal: number; delivery_fee: number; total: number;
  delivery_address: { address?: string; city?: string; area?: string; building?: string; apartment?: string };
  delivery_date: string; delivery_time: string; gift_message: string; payment_method: string; payment_status: string;
  status: string; customer_name: string; customer_email: string; customer_phone: string;
  products: Array<{ product_name: string; quantity: number; unit_price: number; size: string; customization: Record<string, unknown> }>;
  timeline: Array<{ status: string; changed_at: string }>;
};

export default function OrderDetails() {
  const { ref } = useParams();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch(`/api/orders/${encodeURIComponent(ref || "")}`).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.statusMessage || "Order details could not be loaded.");
      setOrder(data);
    }).catch(reason => setError(reason instanceof Error ? reason.message : "Order details could not be loaded."));
  }, [ref]);
  const address = order?.delivery_address;
  return <Layout><main className="confirmation order-details-page"><div className="confirm-icon"><Check/></div><span className="eyebrow">{order ? "ORDER DETAILS" : "ORDER CONFIRMATION"}</span><h1>{order ? <>Thank you, <em>{order.customer_name.split(" ")[0]}.</em></> : <>Your order is <em>received.</em></>}</h1>{error?<p role="alert">{error}</p>:!order?<p>Loading your order details…</p>:<><div className="reference-box"><span>ORDER REFERENCE</span><strong>{order.order_number}</strong></div><p>Placed {new Date(order.created_at).toLocaleString()}</p><section className="order-detail-section"><h3>Items</h3>{order.products.map((item,index)=><div className="order-detail-product" key={`${item.product_name}-${index}`}><div><strong>{item.product_name}</strong><small>{item.size} · Quantity {item.quantity}</small>{Object.keys(item.customization || {}).length>0&&<small>{Object.entries(item.customization).map(([key,value])=>`${key}: ${Array.isArray(value)?value.join(", "):String(value)}`).join(" · ")}</small>}</div><span>{money(item.unit_price*item.quantity)}</span></div>)}</section><section className="order-detail-section"><h3>Customer & delivery</h3><p>{order.customer_name} · {order.customer_phone} · {order.customer_email}</p><p>{[address?.address,address?.building,address?.apartment,address?.area,address?.city].filter(Boolean).join(", ")}</p><p>{new Date(`${order.delivery_date}T00:00:00`).toLocaleDateString()} · {order.delivery_time}</p>{order.gift_message&&<p><strong>Customer note:</strong> {order.gift_message}</p>}</section><section className="order-detail-section"><h3>Order timeline</h3><ol className="order-timeline">{order.timeline.map((event,index)=><li key={`${event.status}-${index}`}><span className="timeline-dot"/><div><strong>{event.status}</strong><small>{new Date(event.changed_at).toLocaleString()}</small></div></li>)}</ol></section><section className="order-detail-section"><h3>Payment</h3><p>{order.payment_method === "cash_on_delivery" ? "Cash on Delivery" : order.payment_method} · {order.payment_status}</p></section><section className="order-totals"><div><span>Subtotal</span><strong>{money(order.subtotal)}</strong></div><div><span>Delivery fee</span><strong>{money(order.delivery_fee)}</strong></div><div className="final-total"><span>Total</span><strong>{money(order.total)}</strong></div></section></>}<Link className="button button-dark" to="/shop">Back to flowers <ArrowRight size={15}/></Link></main></Layout>;
}
