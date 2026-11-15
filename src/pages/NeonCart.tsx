import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import { Minus, Plus, X } from "lucide-react";
import { Layout } from "../storefront";
import { money, useStore } from "../store";

function bouquetDescription(value?: string) {
  if (!value) return "Freshly arranged";
  try {
    const bouquet = JSON.parse(value);
    return [bouquet.flowers?.join(", "), bouquet.color, bouquet.wrapping, bouquet.extras?.join(", ")].filter(Boolean).join(" · ");
  } catch {
    return value;
  }
}

export default function NeonCart() {
  const { cart, quantity, remove, cartNotice, dismissCartNotice } = useStore();
  const reduceMotion = useReducedMotion();
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  return (
    <Layout>
      <main className="simple-page">
        <span className="eyebrow">YOUR FLOWERS</span>
        <h1>Your <em>bag.</em></h1>
        {cartNotice && (
          <motion.p role="alert" className="tracking-error" initial={reduceMotion ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
            {cartNotice}
            <button onClick={dismissCartNotice} aria-label="Dismiss message"><X size={14} /></button>
          </motion.p>
        )}
        {!cart.length ? (
          <div className="no-products">
            <h2>A little space for something lovely.</h2>
            <Link className="button button-dark" to="/shop">Explore flowers</Link>
          </div>
        ) : (
          <div className="cart-page-grid">
            <div>
              <AnimatePresence initial={false}>
                {cart.map((item, index) => (
                  <motion.div
                    className="cart-line"
                    key={`${item.product.id}-${index}`}
                    layout
                    initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 30, height: 0, paddingBlock: 0 }}
                    transition={{ duration: reduceMotion ? 0 : 0.26, ease: "easeOut" }}
                  >
                    <img src={item.product.image} alt={item.product.name} />
                    <div>
                      <h3>{item.product.name}</h3>
                      {item.product.category !== "Custom bouquet" && (item.product.available === false || (item.product.stockQuantity !== null && item.product.stockQuantity !== undefined && item.product.stockQuantity < item.quantity)) && (
                        <p role="alert" className="tracking-error">This product is unavailable in the selected quantity.</p>
                      )}
                      <p>{item.size} · {bouquetDescription(item.custom)}</p>
                      <div className="quantity-control">
                        <button onClick={() => quantity(item.product.id, -1)} aria-label="Decrease quantity"><Minus size={14} /></button>
                        <motion.span key={item.quantity} initial={reduceMotion ? false : { scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>{item.quantity}</motion.span>
                        <button onClick={() => quantity(item.product.id, 1)} aria-label="Increase quantity"><Plus size={14} /></button>
                        <button onClick={() => remove(item.product.id)}>Remove</button>
                      </div>
                    </div>
                    <strong>{money(item.product.price * item.quantity)}</strong>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
            <aside className="order-summary">
              <h2>Order summary</h2>
              <div><span>Subtotal estimate</span><strong>{money(subtotal)}</strong></div>
              <div><span>Delivery</span><span>Calculated at checkout</span></div>
              <Link className="button button-dark checkout-button" to="/checkout">Continue to checkout</Link>
            </aside>
          </div>
        )}
      </main>
    </Layout>
  );
}