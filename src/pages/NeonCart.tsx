import { Link } from "react-router-dom";
import { Minus, Plus, X } from "lucide-react";
import { Layout } from "../storefront";
import { money, useStore } from "../store";

function bouquetDescription(value?: string) {
  if (!value) return "Freshly arranged";
  try {
    const bouquet = JSON.parse(value);
    return [bouquet.flowers?.join(", "), bouquet.color, bouquet.wrapping, bouquet.extras?.join(", ")].filter(Boolean).join(" · ");
  } catch { return value; }
}

export default function NeonCart() {
  const { cart, quantity, remove, cartNotice, dismissCartNotice } = useStore();
  const subtotal = cart.reduce((sum,item)=>sum+item.product.price*item.quantity,0);
  return <Layout><main className="simple-page"><span className="eyebrow">YOUR FLOWERS</span><h1>Your <em>bag.</em></h1>{cartNotice&&<p role="alert" className="tracking-error">{cartNotice}<button onClick={dismissCartNotice} aria-label="Dismiss message"><X size={14}/></button></p>}{!cart.length?<div className="no-products"><h2>A little space for something lovely.</h2><Link className="button button-dark" to="/shop">Explore flowers</Link></div>:<div className="cart-page-grid"><div>{cart.map((item,index)=><div className="cart-line" key={`${item.product.id}-${index}`}><img src={item.product.image} alt={item.product.name}/><div><h3>{item.product.name}</h3>{item.product.category!=="Custom bouquet"&&(item.product.available===false||item.product.stockQuantity!==null&&item.product.stockQuantity!==undefined&&item.product.stockQuantity<item.quantity)&&<p role="alert" className="tracking-error">This product is unavailable in the selected quantity.</p>}<p>{item.size} · {bouquetDescription(item.custom)}</p><div className="quantity-control"><button onClick={()=>quantity(item.product.id,-1)} aria-label="Decrease quantity"><Minus size={14}/></button>{item.quantity}<button onClick={()=>quantity(item.product.id,1)} aria-label="Increase quantity"><Plus size={14}/></button><button onClick={()=>remove(item.product.id)}>Remove</button></div></div><strong>{money(item.product.price*item.quantity)}</strong></div>)}</div><aside className="order-summary"><h2>Order summary</h2><div><span>Subtotal estimate</span><strong>{money(subtotal)}</strong></div><div><span>Delivery</span><span>Calculated at checkout</span></div><Link className="button button-dark checkout-button" to="/checkout">Continue to checkout</Link></aside></div>}</main></Layout>;
}
