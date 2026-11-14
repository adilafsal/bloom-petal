import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowRight, Check, Minus, Plus } from "lucide-react";
import { Layout, ProductGrid } from "../storefront";
import { money, useStore } from "../store";
import { giftMessageForOrder, loadCategories, loadProducts, submitOrder, toServerItems, type StoreProduct } from "../lib/store-api";

const allFlowersCategory = "All flowers";

export function NeonShop() {
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<string[]>([allFlowersCategory]);
  const [category, setCategory] = useState(allFlowersCategory);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("Featured");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [params] = useSearchParams();
  useEffect(() => {
    const requestedCategory = params.get("category");
    if (requestedCategory) setCategory(requestedCategory);
    setSearch(params.get("q") || "");
  }, [params]);
  useEffect(() => {
    let mounted = true;
    Promise.all([loadProducts(), loadCategories()]).then(([items, categoryRows]) => {
      if (!mounted) return;
      setProducts(items);
      setCategories([allFlowersCategory, ...categoryRows.map(item => item.name)]);
    }).catch(error => { if (mounted) setError(error instanceof Error ? error.message : "The flower collection is unavailable."); }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);
  let visible = products.filter(product => (category === allFlowersCategory || product.category === category) && product.name.toLowerCase().includes(search.toLowerCase()));
  if (sort === "Price: Low to High") visible = [...visible].sort((a,b) => a.price-b.price);
  if (sort === "Price: High to Low") visible = [...visible].sort((a,b) => b.price-a.price);
  if (sort === "New Arrivals") visible = [...visible].reverse();
  return <Layout><main className="catalog-page"><div className="catalog-hero"><span className="eyebrow">ARRANGED WITH CARE, ALWAYS</span><h1>Our Flower <em>Collection</em></h1><p>Find the flowers for the words you can't quite find. Each one arranged fresh, just for you.</p></div><div className="catalog-tools"><div className="filter-tabs">{categories.map(item=><button className={category===item?"selected":""} key={item} onClick={()=>setCategory(item)}>{item}</button>)}</div><div className="catalog-controls"><label><input aria-label="Search flowers" placeholder="Search flowers" value={search} onChange={event=>setSearch(event.target.value)}/></label><label><select aria-label="Sort flowers" value={sort} onChange={event=>setSort(event.target.value)}><option>Featured</option><option>Price: Low to High</option><option>Price: High to Low</option><option>New Arrivals</option></select></label></div></div>{loading?<p className="catalog-count">Loading the flower collection…</p>:error?<div className="no-products"><h2>Flowers are temporarily unavailable.</h2><p>{error}</p></div>:<><p className="catalog-count">{visible.length} arrangements, made with love</p>{visible.length?<ProductGrid products={visible}/>:<div className="no-products"><h2>No flowers found just yet.</h2><p>Try another search or category.</p></div>}</>}<div className="builder-promo"><span className="eyebrow">SOMETHING A LITTLE MORE PERSONAL</span><h2>Make it yours.</h2><p>Choose the flowers, colours and finishing touches.</p><Link className="button button-dark" to="/builder">Build a bouquet <ArrowRight size={16}/></Link></div></main></Layout>;
}

export function NeonProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [error, setError] = useState("");
  const [size, setSize] = useState("Medium");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const { add } = useStore();
  useEffect(() => { loadProducts().then(items => setProduct(items.find(item => String(item.id) === id) || null)).catch(e => setError(e.message)); }, [id]);
  if (error) return <Layout><div className="empty-page"><h1>Flower details are unavailable.</h1><p>{error}</p><Link to="/shop">Back to flowers</Link></div></Layout>;
  if (!product) return <Layout><div className="empty-page"><h1>Loading flower details…</h1></div></Layout>;
  const price = size === "Small" ? Math.max(89, product.price - 50) : size === "Large" ? product.price + 50 : product.price;
  const outOfStock = product.stockQuantity === 0;
  return <Layout><main className="detail-page"><div className="breadcrumbs"><Link to="/shop">Flowers</Link> / {product.category} / {product.name}</div><div className="detail-grid"><div className="detail-image"><img src={product.image} alt={`${product.name} flower arrangement`} onError={event=>event.currentTarget.src="https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=800&q=85"}/><span>Arranged fresh, just for you</span></div><div className="detail-copy"><span className="eyebrow">{product.category.toUpperCase()} · MADE WITH CARE</span><h1>{product.name}</h1><div className="detail-price">{money(price)}{product.regularPrice&&product.regularPrice>product.price&&size==="Medium"&&<del>{money(product.regularPrice)}</del>}</div><p>{product.description}</p>{product.stockQuantity!==null&&<p className="stock-note">{outOfStock?"Currently out of stock":`${product.stockQuantity} available`}</p>}<h3>Choose your size</h3><div className="size-options">{["Small","Medium","Large"].map(selectedSize=><button className={size===selectedSize?"chosen":""} key={selectedSize} onClick={()=>setSize(selectedSize)}><span>{selectedSize}</span><small>{money(selectedSize==="Small"?Math.max(89,product.price-50):selectedSize==="Large"?product.price+50:product.price)}</small></button>)}</div><label className="field-label">Gift message (optional)<textarea value={note} maxLength={180} onChange={event=>setNote(event.target.value)}/></label><div className="detail-purchase"><div className="quantity-select"><button aria-label="Decrease quantity" onClick={()=>setQuantity(Math.max(1,quantity-1))}><Minus size={14}/></button><span>{quantity}</span><button aria-label="Increase quantity" disabled={outOfStock||product.stockQuantity!==null&&quantity>=product.stockQuantity} onClick={()=>setQuantity(Math.min(product.stockQuantity??99,quantity+1))}><Plus size={14}/></button></div><button className="button button-dark" disabled={outOfStock} onClick={()=>{for(let index=0;index<quantity;index++) add({...product,price},size,note||undefined)}}>{outOfStock?"Out of stock":"Add to your bag"} {!outOfStock&&<ArrowRight size={15}/>}</button></div></div></div></main></Layout>;
}

export function NeonCheckout() {
  const { cart, clear } = useStore();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [onlineAvailable, setOnlineAvailable] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash_on_delivery" | "online">("cash_on_delivery");
  const [form, setForm] = useState({ name:"", email:"", phone:"", address:"", city:"", area:"", building:"", apartment:"", date:"", time:"9am–1pm", message:"" });
  useEffect(() => { fetch("/api/payment-config").then(response => response.json()).then(result => setOnlineAvailable(Boolean(result.onlinePaymentsEnabled))).catch(() => setOnlineAvailable(false)); }, []);
  const subtotal = cart.reduce((sum,item)=>sum+item.product.price*item.quantity,0);
  const update = (key: keyof typeof form, value: string) => setForm(current=>({...current,[key]:value}));
  async function placeOrder(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const items = toServerItems(cart);
      const result = await submitOrder({
        customer:{fullName:form.name,email:form.email,phone:form.phone},
        items,
        delivery:{address:form.address,city:form.city,area:form.area,building:form.building,apartment:form.apartment,date:form.date,time:form.time},
        giftMessage:giftMessageForOrder(cart, form.message),
        paymentMethod,
      });
      clear();
      if (paymentMethod === "online") {
        if (!result.checkoutUrl) throw new Error("The payment provider did not return a checkout session. Contact the shop before retrying.");
        window.location.assign(result.checkoutUrl);
      } else navigate(`/confirmation/${result.reference}`);
    } catch (e) { setError(e instanceof Error?e.message:"Unable to place your order right now."); }
    finally { setBusy(false); }
  }
  if (!cart.length) return <Layout><main className="simple-page"><h1>Your bag is <em>empty.</em></h1><Link className="button button-dark" to="/shop">Find your flowers</Link></main></Layout>;
  return <Layout><main className="checkout-page"><div className="catalog-hero"><span className="eyebrow">JUST A FEW DETAILS</span><h1>Let's send some <em>joy.</em></h1><p>Orders are submitted to the connected Neon database. Payment remains Cash on Delivery.</p></div><form className="checkout-grid" onSubmit={placeOrder}><div className="checkout-fields"><section><h2>Your details</h2><div className="form-grid"><label>Full name<input required value={form.name} onChange={e=>update("name",e.target.value)}/></label><label>Email address<input required type="email" value={form.email} onChange={e=>update("email",e.target.value)}/></label><label>Phone number<input required type="tel" value={form.phone} onChange={e=>update("phone",e.target.value)}/></label></div></section><section><h2>Delivery details</h2><label>Street address<input required value={form.address} onChange={e=>update("address",e.target.value)}/></label><div className="form-grid"><label>City<input required value={form.city} onChange={e=>update("city",e.target.value)}/></label><label>Area<input required value={form.area} onChange={e=>update("area",e.target.value)}/></label><label>Building / villa<input required value={form.building} onChange={e=>update("building",e.target.value)}/></label><label>Apartment (optional)<input value={form.apartment} onChange={e=>update("apartment",e.target.value)}/></label><label>Delivery date<input required type="date" min={new Date().toISOString().slice(0,10)} value={form.date} onChange={e=>update("date",e.target.value)}/></label><label>Delivery time<select value={form.time} onChange={e=>update("time",e.target.value)}>{["9am–1pm","1pm–5pm","5pm–9pm"].map(s=><option key={s}>{s}</option>)}</select></label></div></section><section><h2>Gift message</h2><label>Message (optional)<textarea maxLength={500} value={form.message} onChange={e=>update("message",e.target.value)}/></label><p className="payment-honest">Cash on Delivery only. No online payment gateway is configured.</p></section></div><aside className="order-summary"><h2>Your order</h2>{cart.map((item,index)=><div className="summary-product" key={`${item.product.id}-${index}`}><span>{item.product.name} · {item.size} × {item.quantity}</span><strong>{money(item.product.price*item.quantity)}</strong></div>)}<div><span>Subtotal (server-calculated)</span><strong>{money(subtotal)}</strong></div><div><span>Delivery</span><strong>AED 25</strong></div><button className="button button-dark checkout-button" disabled={busy}>{busy?"Submitting order…":"Place order · Cash on Delivery"} <ArrowRight size={15}/></button>{error&&<p role="alert" className="tracking-error">{error}</p>}<small className="demo-disclosure">Product prices and availability are validated by the server.</small></aside></form></main></Layout>;
}

export function NeonConfirmation() {
  const { ref } = useParams();
  const [params] = useSearchParams();
  const onlinePaid = params.get("payment") === "success";
  const { clear } = useStore();
  useEffect(() => { if (onlinePaid) clear(); }, [onlinePaid]);
  return <Layout><main className="confirmation"><div className="confirm-icon"><Check/></div><span className="eyebrow">ORDER RECEIVED</span><h1>Thank you, <em>lovely.</em></h1><p>{onlinePaid ? "Your secure payment checkout is complete. The payment confirmation is being recorded." : "Your order has been saved. Our florist will follow up to confirm delivery details and Cash on Delivery."}</p><div className="reference-box"><span>ORDER REFERENCE</span><strong>{ref}</strong></div><p className="demo-disclosure">Order saved to Neon. Email/WhatsApp updates are sent only when the shop configures those providers.</p><Link className="button button-dark" to="/shop">Back to flowers <ArrowRight size={15}/></Link></main></Layout>;
}
