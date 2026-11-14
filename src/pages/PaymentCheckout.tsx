import { useEffect, useRef, useState, type FormEvent } from "react";
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
  const submitting = useRef(false);
  const [error, setError] = useState("");
  const [onlineAvailable, setOnlineAvailable] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash_on_delivery" | "online">("cash_on_delivery");
  const [deliveryOptions, setDeliveryOptions] = useState<{settings:Record<string,any>;zones:Array<{id:string;name:string;city:string;areas:string[];fee:number;minimum_order:number}>;slots:Array<{id:string;label:string;start_time:string;end_time:string;remaining:number}>;closed:boolean}>({settings:{},zones:[],slots:[],closed:false});
  const [zoneId,setZoneId]=useState("");
  const [slotId,setSlotId]=useState("");
  const [form, setForm] = useState({ name:"", email:"", phone:"", address:"", city:"", area:"", building:"", apartment:"", date:new Date(Date.now()+86400000).toISOString().slice(0,10), time:"", instructions:"", message:"" });
  const subtotal = cart.reduce((sum,item)=>sum+item.product.price*item.quantity,0);
  const chosenZone=deliveryOptions.zones.find(zone=>zone.id===zoneId);
  const estimatedFee=chosenZone&&Number(deliveryOptions.settings.freeDeliveryThreshold)>0&&subtotal>=Number(deliveryOptions.settings.freeDeliveryThreshold)?0:chosenZone?.fee??Number(deliveryOptions.settings.defaultDeliveryFee??25);
  const update = (key: keyof typeof form, value: string) => setForm(current=>({...current,[key]:value}));
  useEffect(() => { fetch("/api/payment-config").then(response=>response.json()).then(result=>setOnlineAvailable(Boolean(result.onlinePaymentsEnabled))).catch(()=>setOnlineAvailable(false)); }, []);
  useEffect(() => { fetch(`/api/delivery/options?date=${encodeURIComponent(form.date)}`).then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.statusMessage||"Delivery options unavailable.");setDeliveryOptions(result);setSlotId("");}).catch(err=>setError(err instanceof Error?err.message:"Delivery options unavailable.")); }, [form.date]);
  useEffect(() => { if (params.get("payment") === "cancelled") setError("Payment wasn't completed. Your cart is still available to try again."); }, [params]);

  async function placeOrder(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true); setError("");
    try {
      const result = await submitOrder({
        customer:{fullName:form.name,email:form.email,phone:form.phone},
        items:toServerItems(cart),
        delivery:{address:form.address,city:form.city,area:form.area,building:form.building,apartment:form.apartment,date:form.date,time:form.time,zoneId,slotId,instructions:form.instructions},
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
    finally { submitting.current = false; setBusy(false); }
  }

  if (!cart.length) return <Layout><main className="simple-page"><h1>Your bag is <em>empty.</em></h1><Link className="button button-dark" to="/shop">Find your flowers</Link></main></Layout>;
  return <Layout><main className="checkout-page"><div className="catalog-hero"><span className="eyebrow">JUST A FEW DETAILS</span><h1>Let's send some <em>joy.</em></h1><p>Order prices and availability are checked by the server before saving.</p></div><form className="checkout-grid" onSubmit={placeOrder}><div className="checkout-fields">
    <section><h2>Your details</h2><div className="form-grid"><label>Full name<input required value={form.name} onChange={e=>update("name",e.target.value)}/></label><label>Email address<input required type="email" value={form.email} onChange={e=>update("email",e.target.value)}/></label><label>Phone number<input required type="tel" value={form.phone} onChange={e=>update("phone",e.target.value)}/></label></div></section>
    <section><h2>Delivery details</h2><label>Street address<input required value={form.address} onChange={e=>update("address",e.target.value)}/></label><div className="form-grid"><label>Delivery zone<select required value={zoneId} onChange={e=>{const selected=deliveryOptions.zones.find(z=>z.id===e.target.value);setZoneId(e.target.value);update("city",selected?.city||"");update("area",selected?.areas[0]||"");}}><option value="">Choose a zone</option>{deliveryOptions.zones.map(zone=><option key={zone.id} value={zone.id}>{zone.name} · {zone.city}</option>)}</select></label><label>Area<select required value={form.area} onChange={e=>update("area",e.target.value)}><option value="">Choose an area</option>{(deliveryOptions.zones.find(z=>z.id===zoneId)?.areas||[]).map(area=><option key={area}>{area}</option>)}</select></label><label>Building / villa<input required value={form.building} onChange={e=>update("building",e.target.value)}/></label><label>Apartment (optional)<input value={form.apartment} onChange={e=>update("apartment",e.target.value)}/></label><label>Delivery date<input required type="date" min={new Date().toISOString().slice(0,10)} max={new Date(Date.now()+Number(deliveryOptions.settings.advanceDays||30)*86400000).toISOString().slice(0,10)} value={form.date} onChange={e=>update("date",e.target.value)}/></label><label>Delivery time slot<select required value={slotId} onChange={e=>{setSlotId(e.target.value);update("time",deliveryOptions.slots.find(s=>s.id===e.target.value)?.label||"");}}><option value="">Choose an available slot</option>{deliveryOptions.slots.filter(slot=>slot.remaining>0).map(slot=><option key={slot.id} value={slot.id}>{slot.label} · {slot.start_time.slice(0,5)}–{slot.end_time.slice(0,5)} · {slot.remaining} left</option>)}</select></label></div><label>Delivery instructions<textarea maxLength={500} value={form.instructions} onChange={e=>update("instructions",e.target.value)} placeholder="Gate code, directions, or delivery notes"/></label></section>
    <section><h2>Gift message</h2><label>Note for the recipient (optional)<textarea maxLength={500} value={form.message} onChange={e=>update("message",e.target.value)}/></label></section>
    <section><h2>Payment method</h2><div className="payment-method-options"><label><input type="radio" name="payment" checked={paymentMethod==="cash_on_delivery"} onChange={()=>setPaymentMethod("cash_on_delivery")}/><span><strong>Cash on Delivery</strong><small>Pay when your flowers arrive</small></span></label><label className={!onlineAvailable?"payment-disabled":""}><input type="radio" name="payment" disabled={!onlineAvailable} checked={paymentMethod==="online"} onChange={()=>setPaymentMethod("online")}/><span><strong>Online payment</strong><small>{onlineAvailable?"Secure Stripe Checkout":"Unavailable — payment provider not configured"}</small></span></label></div>{!onlineAvailable&&<p className="payment-honest">Online payment is unavailable until the shop configures Stripe. Cash on Delivery remains available.</p>}</section>
  </div><aside className="order-summary"><h2>Your order</h2>{cart.map((item,index)=><div className="summary-product" key={`${item.product.id}-${index}`}><span>{item.product.name} · {item.size} × {item.quantity}</span><strong>{money(item.product.price*item.quantity)}</strong></div>)}<div><span>Estimated subtotal</span><strong>{money(subtotal)}</strong></div><div><span>Delivery estimate</span><strong>{zoneId?money(estimatedFee):"Choose a zone"}</strong></div>{chosenZone&&subtotal<Math.max(chosenZone.minimum_order,Number(deliveryOptions.settings.minimumOrderAmount||0))&&<p className="payment-honest">Minimum order for this zone: {money(Math.max(chosenZone.minimum_order,Number(deliveryOptions.settings.minimumOrderAmount||0)))}.</p>}<button className="button button-dark checkout-button" disabled={busy||!zoneId||!slotId||!deliveryOptions.settings.deliveryAvailable}>{busy?"Submitting order…":paymentMethod==="online"?"Continue to secure payment":"Place order · Cash on Delivery"} <ArrowRight size={15}/></button>{error&&<p role="alert" className="tracking-error">{error}</p>}<small className="demo-disclosure">Final pricing and availability are validated by the server.</small></aside></form></main></Layout>;
}
