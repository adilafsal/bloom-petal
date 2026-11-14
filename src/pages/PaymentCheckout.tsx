import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Layout } from "../storefront";
import { money, useStore } from "../store";
import { giftMessageForOrder, submitOrder, toServerItems } from "../lib/store-api";
import "../payment-checkout.css";

export default function PaymentCheckout() {
  const { cart, clear } = useStore();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [onlineAvailable, setOnlineAvailable] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash_on_delivery" | "online">("cash_on_delivery");
  const [form, setForm] = useState({ name:"", email:"", phone:"", address:"", city:"", area:"", building:"", apartment:"", date:"", time:"9am–1pm", message:"" });
  const subtotal = cart.reduce((sum,item)=>sum+item.product.price*item.quantity,0);
  const update = (key: keyof typeof form, value: string) => setForm(current=>({...current,[key]:value}));
  useEffect(() => { fetch("/api/payment-config").then(response=>response.json()).then(result=>setOnlineAvailable(Boolean(result.onlinePaymentsEnabled))).catch(()=>setOnlineAvailable(false)); }, []);
  useEffect(() => { if (params.get("payment") === "cancelled") setError("Payment wasn't completed. Your cart is still available to try again."); }, [params]);

  async function placeOrder(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const result = await submitOrder({
        customer:{fullName:form.name,email:form.email,phone:form.phone},
        items:toServerItems(cart),
        delivery:{address:form.address,city:form.city,area:form.area,building:form.building,apartment:form.apartment,date:form.date,time:form.time},
        giftMessage:giftMessageForOrder(cart,form.message),
        paymentMethod,
      });
      if (paymentMethod === "online") {
        if (!result.checkoutUrl) throw new Error("No secure payment session was returned. Contact the shop before retrying.");
        window.location.assign(result.checkoutUrl);
        return;
      }
      clear();
      navigate(`/confirmation/${result.reference}`);
    } catch (err) { setError(err instanceof Error?err.message:"We couldn't submit this order. Please try again."); }
    finally { setBusy(false); }
  }

  if (!cart.length) return <Layout><main className="simple-page"><h1>Your bag is <em>empty.</em></h1><Link className="button button-dark" to="/shop">Find your flowers</Link></main></Layout>;
  return <Layout><main className="checkout-page"><div className="catalog-hero"><span className="eyebrow">JUST A FEW DETAILS</span><h1>Let's send some <em>joy.</em></h1><p>Order prices and availability are checked by the server before saving.</p></div><form className="checkout-grid" onSubmit={placeOrder}><div className="checkout-fields">
    <section><h2>Your details</h2><div className="form-grid"><label>Full name<input required value={form.name} onChange={e=>update("name",e.target.value)}/></label><label>Email address<input required type="email" value={form.email} onChange={e=>update("email",e.target.value)}/></label><label>Phone number<input required type="tel" value={form.phone} onChange={e=>update("phone",e.target.value)}/></label></div></section>
    <section><h2>Delivery details</h2><label>Street address<input required value={form.address} onChange={e=>update("address",e.target.value)}/></label><div className="form-grid"><label>City<input required value={form.city} onChange={e=>update("city",e.target.value)}/></label><label>Area<input required value={form.area} onChange={e=>update("area",e.target.value)}/></label><label>Building / villa<input required value={form.building} onChange={e=>update("building",e.target.value)}/></label><label>Apartment (optional)<input value={form.apartment} onChange={e=>update("apartment",e.target.value)}/></label><label>Delivery date<input required type="date" min={new Date().toISOString().slice(0,10)} value={form.date} onChange={e=>update("date",e.target.value)}/></label><label>Delivery time<select value={form.time} onChange={e=>update("time",e.target.value)}>{["9am–1pm","1pm–5pm","5pm–9pm"].map(slot=><option key={slot}>{slot}</option>)}</select></label></div></section>
    <section><h2>Gift message</h2><label>Note for the recipient (optional)<textarea maxLength={500} value={form.message} onChange={e=>update("message",e.target.value)}/></label></section>
    <section><h2>Payment method</h2><div className="payment-method-options"><label><input type="radio" name="payment" checked={paymentMethod==="cash_on_delivery"} onChange={()=>setPaymentMethod("cash_on_delivery")}/><span><strong>Cash on Delivery</strong><small>Pay when your flowers arrive</small></span></label><label className={!onlineAvailable?"payment-disabled":""}><input type="radio" name="payment" disabled={!onlineAvailable} checked={paymentMethod==="online"} onChange={()=>setPaymentMethod("online")}/><span><strong>Online payment</strong><small>{onlineAvailable?"Secure Stripe Checkout":"Unavailable — payment provider not configured"}</small></span></label></div>{!onlineAvailable&&<p className="payment-honest">Online payment is unavailable until the shop configures Stripe. Cash on Delivery remains available.</p>}</section>
  </div><aside className="order-summary"><h2>Your order</h2>{cart.map((item,index)=><div className="summary-product" key={`${item.product.id}-${index}`}><span>{item.product.name} · {item.size} × {item.quantity}</span><strong>{money(item.product.price*item.quantity)}</strong></div>)}<div><span>Estimated subtotal</span><strong>{money(subtotal)}</strong></div><div><span>Delivery</span><strong>AED 25</strong></div><button className="button button-dark checkout-button" disabled={busy}>{busy?"Submitting order…":paymentMethod==="online"?"Continue to secure payment":"Place order · Cash on Delivery"} <ArrowRight size={15}/></button>{error&&<p role="alert" className="tracking-error">{error}</p>}<small className="demo-disclosure">Final pricing and availability are validated by the server.</small></aside></form></main></Layout>;
}
