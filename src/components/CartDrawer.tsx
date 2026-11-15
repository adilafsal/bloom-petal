import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Minus, Plus, Trash2, X } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { money, useStore } from "../store";

type CartDrawerProps = {
  open: boolean;
  onClose: () => void;
};

export default function CartDrawer({ open, onClose }: CartDrawerProps) {
  const { cart, quantity, remove } = useStore();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const count = cart.reduce((total, item) => total + item.quantity, 0);
  const subtotal = cart.reduce((total, item) => total + item.quantity * item.product.price, 0);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="drawer-backdrop"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          onClick={onClose}
        >
          <motion.aside
            className="cart-drawer"
            aria-label="Shopping bag"
            initial={reduceMotion ? false : { x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: reduceMotion ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
            onClick={event => event.stopPropagation()}
          >
            <div className="drawer-head">
              <div>
                <span className="eyebrow">YOUR FLOWERS</span>
                <h2>Your bag <span>({count})</span></h2>
              </div>
              <button onClick={onClose} aria-label="Close cart"><X /></button>
            </div>
            {cart.length === 0 ? (
              <div className="empty-cart">
                <span className="empty-bloom">✳</span>
                <h3>A little space for something lovely.</h3>
                <p>Your bag is waiting for its first bouquet.</p>
                <Link className="button button-dark" to="/shop" onClick={onClose}>
                  Explore flowers <ArrowRight size={15} />
                </Link>
              </div>
            ) : (
              <>
                <div className="drawer-items">
                  <AnimatePresence initial={false}>
                    {cart.map((item, index) => (
                      <motion.div
                        className="drawer-item"
                        key={`${item.product.id}-${item.size}-${index}`}
                        layout
                        initial={reduceMotion ? false : { opacity: 0, x: 16 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 28, height: 0, paddingBlock: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.24, ease: "easeOut" }}
                      >
                        <img src={item.product.image} alt={item.product.name} />
                        <div className="drawer-item-copy">
                          <Link to={`/product/${item.product.id}`} onClick={onClose}>{item.product.name}</Link>
                          <small>{item.size} · {money(item.product.price)}</small>
                          <div className="quantity-control">
                            <button onClick={() => quantity(item.product.id, -1)} aria-label="Decrease quantity"><Minus size={13} /></button>
                            <motion.span key={item.quantity} initial={reduceMotion ? false : { scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>{item.quantity}</motion.span>
                            <button onClick={() => quantity(item.product.id, 1)} aria-label="Increase quantity"><Plus size={13} /></button>
                            <button className="remove-item" onClick={() => remove(item.product.id)} aria-label="Remove item"><Trash2 size={14} /></button>
                          </div>
                        </div>
                        <strong>{money(item.product.price * item.quantity)}</strong>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
                <div className="drawer-bottom">
                  <div>
                    <span>Subtotal</span>
                    <motion.strong key={subtotal} initial={reduceMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
                      {money(subtotal)}
                    </motion.strong>
                  </div>
                  <p>Delivery calculated at checkout.</p>
                  <button
                    className="button button-dark checkout-button"
                    onClick={() => { onClose(); navigate("/checkout"); }}
                  >
                    Continue to checkout <ArrowRight size={16} />
                  </button>
                  <Link to="/cart" onClick={onClose} className="drawer-cart-link">View full bag</Link>
                </div>
              </>
            )}
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}