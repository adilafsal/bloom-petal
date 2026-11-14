import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight, Check, Home, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { Layout } from "../storefront";
import { money, useStore } from "../store";
import { useAuthSession } from "../lib/auth-client";
import { giftMessageForOrder, submitOrder, toServerItems } from "../lib/store-api";
import "../payment-checkout.css";
import "../saved-addresses.css";
import "../checkout-save-address.css";
import "../checkout-delivery-validation.css";

type Address = { id: string; recipient_name: string; phone: string; label: "Home" | "Work" | "Other"; building: string; street: string; area: string; city: string; delivery_instructions: string; is_default: boolean };
type AddressForm = Omit<Address, "id" | "is_default">;
const blankAddress: AddressForm = { recipient_name: "", phone: "", label: "Home", building: "", street: "", area: "", city: "", delivery_instructions: "" };
const addressFields: Array<[keyof AddressForm, string]> = [["recipient_name", "Full name"], ["phone", "Phone number"], ["building", "Building / villa number"], ["street", "Street name"], ["area", "Area"], ["city", "City"]];

export default function PaymentCheckout() {
  const { cart, clear } = useStore();
  const { data: session, isPending: authPending } = useAuthSession();
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
  const [form, setForm] = useState({ email:"", date:new Date(Date.now()+86400000).toISOString().slice(0,10), time:"", message:"" });
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [draftSelected, setDraftSelected] = useState(false);
  const [newAddress, setNewAddress] = useState<AddressForm>(blankAddress);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [saveAddress, setSaveAddress] = useState(true);
  const [editingId, setEditingId] = useState("");
  const [addressBusy, setAddressBusy] = useState(false);
  const subtotal = cart.reduce((sum,item)=>sum+item.product.price*item.quantity,0);
  const chosenZone=deliveryOptions.zones.find(zone=>zone.id===zoneId);
  const selectedAddress=addresses.find(address=>address.id===selectedId);
  const currentAddress=selectedAddress ?? (showAddressForm||draftSelected ? newAddress : null);
  const matchingZone=currentAddress&&deliveryOptions.zones.find(zone=>zone.city.trim().toLowerCase()===currentAddress.city.trim().toLowerCase()&&zone.areas.some(area=>area.trim().toLowerCase()===currentAddress.area.trim().toLowerCase()));
  const estimatedFee=matchingZone&&Number(deliveryOptions.settings.freeDeliveryThreshold)>0&&subtotal>=Number(deliveryOptions.settings.freeDeliveryThreshold)?0:matchingZone?.fee??Number(deliveryOptions.settings.defaultDeliveryFee??25);
  const matchedDeliveryFee=estimatedFee;
  const selectedSlot=deliveryOptions.slots.find(slot=>slot.id===slotId&&slot.remaining>0);
  const validCart=cart.length>0&&cart.every(item=>Number.isInteger(item.quantity)&&item.quantity>0&&Number.isFinite(item.product.price)&&item.product.price>=0);
  const checkoutBlocker=!currentAddress?"Add or choose a delivery address.":showAddressForm?"Select “Use this address” to continue.":!deliveryOptions.settings.deliveryAvailable?"Delivery is temporarily unavailable.":!matchingZone?"Delivery is unavailable in this area. Change your selected address to one of our supported areas.":!validCart?"Your bag contains an invalid product or quantity. Remove it and add the product again.":!form.date?"Choose a delivery date.":deliveryOptions.closed?"Delivery is unavailable on this date. Choose another date.":!selectedSlot?"Choose an available delivery time slot.":paymentMethod!=="cash_on_delivery"&&!onlineAvailable?"Choose Cash on Delivery; online payment is not configured.":subtotal<Math.max(Number(matchingZone.minimum_order||0),Number(deliveryOptions.settings.minimumOrderAmount||0))?`The minimum order for this area is ${money(Math.max(Number(matchingZone.minimum_order||0),Number(deliveryOptions.settings.minimumOrderAmount||0)))}.`:"";
  const update = (key: keyof typeof form, value: string) => setForm(current=>({...current,[key]:value}));
  const updateAddress = <K extends keyof AddressForm,>(key: K, value: string) => setNewAddress(current=>({...current,[key]:value as AddressForm[K]}));
  const addressApi = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.statusMessage || result.message || "Saved addresses are temporarily unavailable.");
    return result;
  };
  async function loadAddresses(selectDefault = true) {
    if (!session?.user) return;
    const list = await addressApi("/api/addresses") as Address[];
    setAddresses(list);
    if (selectDefault && list.length) { setSelectedId(list.find(item=>item.is_default)?.id || list[0].id); setShowAddressForm(false); setDraftSelected(false); }
    if (!list.length) { setSelectedId(""); setShowAddressForm(true); }
  }
  useEffect(() => { if (session?.user) void loadAddresses(); }, [session?.user?.id]);
  useEffect(() => { if (!authPending && !session?.user) setShowAddressForm(true); }, [authPending,session?.user?.id]);
  useEffect(() => { fetch("/api/payment-config").then(response=>response.json()).then(result=>setOnlineAvailable(Boolean(result.onlinePaymentsEnabled))).catch(()=>setOnlineAvailable(false)); }, []);
  useEffect(() => { fetch(`/api/delivery/options?date=${encodeURIComponent(form.date)}`).then(async response=>{const result=await response.json();if(!response.ok)throw new Error(result.statusMessage||"Delivery options unavailable.");setDeliveryOptions(result);setSlotId("");}).catch(err=>setError(err instanceof Error?err.message:"Delivery options unavailable.")); }, [form.date]);
  useEffect(() => { if (params.get("payment") === "cancelled") setError("Payment wasn't completed. Your cart is still available to try again."); }, [params]);
  useEffect(() => { if(currentAddress?.city){const zone=deliveryOptions.zones.find(item=>item.city.toLowerCase()===currentAddress.city.toLowerCase()&&item.areas.some(area=>area.toLowerCase()===currentAddress.area.toLowerCase()));setZoneId(zone?.id||"");setSlotId("");}}, [currentAddress?.city,currentAddress?.area,deliveryOptions.zones]);

  async function saveCurrentAddress() {
    if (!newAddress.recipient_name || !newAddress.phone || !newAddress.building || !newAddress.street || !newAddress.area || !newAddress.city) { setError("Please complete all required address fields."); return; }
    setAddressBusy(true); setError("");
    try {
      if (editingId) {
        await addressApi(`/api/addresses/${editingId}`, { method:"PATCH", body:JSON.stringify(newAddress) });
        await loadAddresses(false); setSelectedId(editingId); setEditingId(""); setShowAddressForm(false); setDraftSelected(false);
      } else if (session?.user && saveAddress) {
        const saved = await addressApi("/api/addresses", { method:"POST", body:JSON.stringify({...newAddress,is_default:addresses.length===0}) }) as Address[];
        setAddresses(items=>[saved[0],...items]); setSelectedId(saved[0].id); setDraftSelected(false); setShowAddressForm(false);
      } else { setSelectedId(""); setDraftSelected(true); setShowAddressForm(false); }
    } catch (err) { setError(err instanceof Error?err.message:"We couldn't save this address."); }
    finally { setAddressBusy(false); }
  }
  async function chooseDefault(id: string) {
    try { await addressApi(`/api/addresses/${id}`,{method:"PATCH",body:JSON.stringify({make_default:true})}); await loadAddresses(false); }
    catch(err) { setError(err instanceof Error?err.message:"Could not update the default address."); }
  }
  async function removeAddress(id: string) {
    if (!window.confirm("Delete this saved address?")) return;
    try { await addressApi(`/api/addresses/${id}`,{method:"DELETE"}); await loadAddresses(); }
    catch(err) { setError(err instanceof Error?err.message:"Could not delete this address."); }
  }
  function editAddress(address: Address) {
    const { id, is_default, ...details }=address;
    setSelectedId(id); setNewAddress(details); setEditingId(id); setShowAddressForm(true); setDraftSelected(false);
  }

  async function placeOrder(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (!currentAddress || showAddressForm) { setError("Save or select a delivery address before placing your order."); return; }
    submitting.current = true; setBusy(true); setError("");
    try {
      const result = await submitOrder({
        customer:{fullName:currentAddress.recipient_name,email:session?.user?.email || form.email,phone:currentAddress.phone},
        items:toServerItems(cart),
        delivery:{address:currentAddress.street,city:currentAddress.city,area:currentAddress.area,building:currentAddress.building,apartment:"",date:form.date,time:form.time,zoneId,slotId,instructions:currentAddress.delivery_instructions,savedAddressId:selectedId||undefined},
        giftMessage:giftMessageForOrder(cart,form.message), paymentMethod,
      });
      if (paymentMethod === "online") { if (!result.checkoutUrl) throw new Error("No secure payment session was returned. Contact the shop before retrying."); window.location.assign(result.checkoutUrl); return; }
      clear(); navigate(`/confirmation/${result.reference}`);
    } catch (err) { setError(err instanceof Error?err.message:"We couldn't submit this order. Please try again."); }
    finally { submitting.current = false; setBusy(false); }
  }

  if (!cart.length) return <Layout><main className="simple-page"><h1>Your bag is <em>empty.</em></h1><Link className="button button-dark" to="/shop">Find your flowers</Link></main></Layout>;
  return <Layout><main className="checkout-page"><div className="catalog-hero"><span className="eyebrow">JUST A FEW DETAILS</span><h1>Let's send some <em>joy.</em></h1><p>Order prices and availability are checked by the server before saving.</p></div><form className="checkout-grid" onSubmit={placeOrder}><div className="checkout-fields">
    <section><h2>Delivery address</h2>{session?.user&&addresses.length>0&&<p className="address-subtitle">Use a saved address or add another one.</p>}
      {addresses.length>0&&<div className="saved-address-grid">{addresses.map(address=><article key={address.id} className={`saved-address-card ${selectedId===address.id&&!showAddressForm?"selected":""}`}><button type="button" className="address-select" onClick={()=>{setSelectedId(address.id);setDraftSelected(false);setShowAddressForm(false);setEditingId("");}} aria-pressed={selectedId===address.id&&!showAddressForm}><span className="address-card-top"><span className="address-label"><Home size={15}/>{address.label}</span>{address.is_default&&<span className="address-default">Default</span>}</span><strong>{address.recipient_name}</strong><span>{address.phone}</span><span>{address.building} · {address.street}</span><span>{address.area}, {address.city}</span>{address.delivery_instructions&&<small>{address.delivery_instructions}</small>}<span className="address-use">{selectedId===address.id&&!showAddressForm?<><Check size={14}/> Use this address</>:"Choose this address"}</span></button><div className="address-actions"><button type="button" onClick={()=>editAddress(address)}><Pencil size={13}/> Edit</button>{!address.is_default&&<button type="button" onClick={()=>void chooseDefault(address.id)}>Make default</button>}<button type="button" onClick={()=>void removeAddress(address.id)} aria-label="Delete address"><Trash2 size={13}/></button></div></article>)}</div>}
      {session?.user&&<button type="button" className={`add-address-choice ${showAddressForm?"active":""}`} onClick={()=>{setSelectedId("");setDraftSelected(false);setEditingId("");setNewAddress(blankAddress);setShowAddressForm(true);}}><Plus size={17}/>{addresses.length?"Add a new address":"Add your first address"}</button>}
      {showAddressForm&&<div className="new-address-panel"><h3>{editingId?"Edit address":"New delivery address"}</h3><div className="address-form-grid">{addressFields.slice(0,2).map(([key,label])=><label key={key}>{label}<input required autoComplete={key==="recipient_name"?"name":"tel"} value={newAddress[key]} onChange={event=>updateAddress(key,event.target.value)}/></label>)}<label>Address label<select value={newAddress.label} onChange={event=>updateAddress("label",event.target.value)}><option>Home</option><option>Work</option><option>Other</option></select></label>{addressFields.slice(2).map(([key,label])=><label key={key}>{label}<input required value={newAddress[key]} onChange={event=>updateAddress(key,event.target.value)}/></label>)}</div><label>Additional delivery instructions<textarea maxLength={500} value={newAddress.delivery_instructions} onChange={event=>updateAddress("delivery_instructions",event.target.value)} placeholder="Gate code, directions, or delivery notes"/></label>{session?.user&&!editingId&&<label className="save-address-check"><input type="checkbox" checked={saveAddress} onChange={event=>setSaveAddress(event.target.checked)}/> Save this address for future orders</label>}{!session?.user&&<label>Email address<input required type="email" value={form.email} onChange={event=>update("email",event.target.value)}/></label>}<button type="button" className="address-save-button" disabled={addressBusy} onClick={()=>void saveCurrentAddress()}>{addressBusy?"Saving…":editingId?"Save changes":"Use this address"}</button>{editingId&&<button type="button" className="address-cancel-button" onClick={()=>{setEditingId("");setShowAddressForm(false);}}>Cancel</button>}</div>}
      {currentAddress&&!showAddressForm&&<p className="selected-address-note"><MapPin size={15}/> Delivering to {currentAddress.building}, {currentAddress.street}, {currentAddress.area}, {currentAddress.city}</p>}
      {currentAddress&&!showAddressForm&&!matchingZone&&<p className="delivery-address-status unavailable" role="status">{deliveryOptions.zones.length?`Delivery isn’t available in ${currentAddress.area || currentAddress.city}. Choose a different saved address or edit this address.`:"No delivery areas are currently available. Please contact the shop before placing your order."}</p>}
      {matchingZone&&!showAddressForm&&<p className="delivery-address-status available" role="status">Delivery is available · {money(matchedDeliveryFee)} delivery · approximately {matchingZone.estimated_minutes} minutes{slotId?"":" · Choose an available time below."}</p>}
      <div className="form-grid delivery-schedule"><label>Delivery date<input required type="date" min={new Date().toISOString().slice(0,10)} max={new Date(Date.now()+Number(deliveryOptions.settings.advanceDays||30)*86400000).toISOString().slice(0,10)} value={form.date} onChange={e=>update("date",e.target.value)}/></label><label>Delivery time slot<select required value={slotId} onChange={e=>{setSlotId(e.target.value);update("time",deliveryOptions.slots.find(s=>s.id===e.target.value)?.label||"");}}><option value="">Choose an available slot</option>{deliveryOptions.slots.map(slot=><option key={slot.id} value={slot.id} disabled={slot.remaining<=0}>{slot.label} · {slot.start_time.slice(0,5)}–{slot.end_time.slice(0,5)}{slot.remaining<=0?" · Unavailable":` · ${slot.remaining} left`}</option>)}</select></label></div>
    </section>
    {checkoutBlocker&&<p className="delivery-address-status unavailable" role="status">{checkoutBlocker}</p>}
    <section><h2>Gift message</h2><label>Note for the recipient (optional)<textarea maxLength={500} value={form.message} onChange={e=>update("message",e.target.value)}/></label></section>
    <section><h2>Payment method</h2><div className="payment-method-options"><label><input type="radio" name="payment" checked={paymentMethod==="cash_on_delivery"} onChange={()=>setPaymentMethod("cash_on_delivery")}/><span><strong>Cash on Delivery</strong><small>Pay when your flowers arrive</small></span></label><label className={!onlineAvailable?"payment-disabled":""}><input type="radio" name="payment" disabled={!onlineAvailable} checked={paymentMethod==="online"} onChange={()=>setPaymentMethod("online")}/><span><strong>Online payment</strong><small>{onlineAvailable?"Secure Stripe Checkout":"Unavailable — payment provider not configured"}</small></span></label></div>{!onlineAvailable&&<p className="payment-honest">Online payment is unavailable until the shop configures Stripe. Cash on Delivery remains available.</p>}</section>
  </div><aside className="order-summary"><h2>Your order</h2>{cart.map((item,index)=><div className="summary-product" key={`${item.product.id}-${index}`}><span>{item.product.name} · {item.size} × {item.quantity}</span><strong>{money(item.product.price*item.quantity)}</strong></div>)}<div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div><span>Delivery fee</span><strong>{matchingZone?money(estimatedFee):"Calculated when area is supported"}</strong></div><div className="summary-total"><span>Total</span><strong>{money(subtotal+(matchingZone?estimatedFee:0))}</strong></div><button className="button button-dark checkout-button" disabled={busy||addressBusy||Boolean(checkoutBlocker)}>{busy?"Submitting order…":"Place order · Cash on Delivery"} <ArrowRight size={15}/></button>{error&&<p role="alert" className="tracking-error">{error}</p>}<small className="demo-disclosure">{checkoutBlocker||"Ready to place your Cash on Delivery order."} Final pricing and availability are validated by the server.</small></aside></form></main></Layout>;
}
