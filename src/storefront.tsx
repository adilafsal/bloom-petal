import { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, Flower2, Heart, Instagram, Menu, Plus, Search, ShoppingBag } from "lucide-react";
import type { Product } from "./store";
import { useStore, money } from "./store";
import CartDrawer from "./components/CartDrawer";

const FAVOURITES_KEY = "bp-favourite-flowers";

function readFavourites(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(FAVOURITES_KEY) || "[]");
    return Array.isArray(value) ? value.map(String) : [];
  } catch {
    return [];
  }
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { cart } = useStore();
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(false);
  const nav = useNavigate();
  const location = useLocation();
  const count = cart.reduce((total, item) => total + item.quantity, 0);

  useEffect(() => {
    setMobile(false);
    setSearch(false);
  }, [location.pathname]);

  return (
    <div className="site-shell">
      <div className="announcement">Fresh flowers, thoughtfully arranged <span>·</span> Same-day delivery available</div>
      <header className="site-header">
        <button className="mobile-menu-button" onClick={() => setMobile(!mobile)} aria-label="Navigation" aria-expanded={mobile}><Menu /></button>
        <Link to="/" className="wordmark"><span className="logo-flower"><Flower2 size={24} /></span><span>Bloom <i>&</i> Petal</span></Link>
        <nav className={mobile ? "main-nav is-open" : "main-nav"}>
          <Link to="/">Home</Link>
          <Link to="/shop">Shop</Link>
          <Link to="/builder">Build a bouquet</Link>
          <Link to="/#occasions">Occasions</Link>
          <Link to="/about">Our story</Link>
          <Link to="/contact">Contact</Link>
        </nav>
        <div className="header-actions">
          <button onClick={() => setSearch(!search)} aria-label="Search" aria-expanded={search}><Search size={19} /></button>
          <button className="bag-button" onClick={() => setOpen(true)} aria-label="Shopping bag">
            <ShoppingBag size={20} />
            <AnimatePresence>
              {count > 0 && <motion.span className="bag-count" key={count} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>{count}</motion.span>}
            </AnimatePresence>
          </button>
        </div>
      </header>
      <AnimatePresence initial={false}>
        {search && (
          <motion.form
            className="search-bar"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onSubmit={event => {
              event.preventDefault();
              nav(`/shop?q=${(event.currentTarget.elements.namedItem("q") as HTMLInputElement).value}`);
              setSearch(false);
            }}
          >
            <Search size={17} />
            <input name="q" autoFocus placeholder="Find something lovely…" />
            <button aria-label="Search flowers"><ArrowRight size={16} /></button>
          </motion.form>
        )}
      </AnimatePresence>
      {children}
      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-brand">
            <Link to="/" className="wordmark"><span className="logo-flower"><Flower2 size={22} /></span><span>Bloom <i>&</i> Petal</span></Link>
            <p>Flowers for the everyday and the extraordinary, arranged with care.</p>
            <a className="instagram-link" href="https://instagram.com" target="_blank" rel="noreferrer"><Instagram size={16} /> Find us on Instagram</a>
          </div>
          <div className="footer-links">
            <div><h4>Explore</h4><Link to="/shop">All flowers</Link><Link to="/builder">Build your bouquet</Link><Link to="/shop">Flower boxes</Link></div>
            <div><h4>Here to help</h4><Link to="/delivery">Delivery information</Link><Link to="/track">Track an order</Link><Link to="/contact">Contact us</Link></div>
            <div><h4>Say hello</h4><Link to="/contact">Contact us</Link><Link to="/admin">Shop admin demo</Link></div>
          </div>
        </div>
        <div className="footer-bottom"><span>© 2025 Bloom & Petal.</span><span>Thoughtfully arranged, always.</span></div>
      </footer>
      <CartDrawer open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function FavouriteButton({ product }: { product: Product }) {
  const reduceMotion = useReducedMotion();
  const [favourite, setFavourite] = useState(() => readFavourites().includes(String(product.id)));

  const toggle = () => {
      const id = String(product.id);
      const next = !favourite;
      setFavourite(next);
      try {
        const current = readFavourites().filter(value => value !== id);
        localStorage.setItem(FAVOURITES_KEY, JSON.stringify(next ? [...current, id] : current));
      } catch {
        /* favourites remain visual-only when storage is unavailable */
      }
    };

  return (
    <button
      type="button"
      className={`favorite-button ${favourite ? "active" : ""}`}
      aria-label={favourite ? `Remove ${product.name} from favourites` : `Save ${product.name} to favourites`}
      aria-pressed={favourite}
      onClick={toggle}
    >
      <motion.span
        animate={favourite && !reduceMotion ? { scale: [1, 1.35, 1] } : { scale: 1 }}
        transition={{ duration: 0.36, ease: "easeOut" }}
      >
        <Heart size={17} fill={favourite ? "currentColor" : "none"} />
      </motion.span>
    </button>
  );
}

type ProductGridProps = {
  products: Product[];
  onAdd?: (product: Product) => void;
};

export function ProductGrid({ products, onAdd }: ProductGridProps) {
  const { add } = useStore();
  const reduceMotion = useReducedMotion();

  return (
    <div className="product-grid">
      {products.map((product, index) => (
        <ProductCard
          key={product.id}
          product={product}
          index={index}
          reduceMotion={Boolean(reduceMotion)}
          add={add}
          onAdd={onAdd}
        />
      ))}
    </div>
  );
}

function ProductCard({
  product,
  index,
  reduceMotion,
  add,
  onAdd,
}: {
  product: Product;
  index: number;
  reduceMotion: boolean;
  add: (product: Product, size?: string, custom?: string) => void;
  onAdd?: (product: Product) => void;
}) {
  const [justAdded, setJustAdded] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const outOfStock = product.available === false || product.stockQuantity === 0;

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const handleAdd = () => {
    add(product);
    onAdd?.(product);
    setJustAdded(true);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setJustAdded(false), 1600);
  };

  return (
    <motion.article
      className="product-card"
      initial={reduceMotion ? false : { opacity: 0, y: 26 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.52, delay: Math.min(index, 7) * 0.055, ease: [0.22, 1, 0.36, 1] }}
      whileHover={reduceMotion ? undefined : { y: -5 }}
    >
      <Link to={`/product/${product.id}`} className="product-photo">
        <img
          src={product.image}
          alt={`${product.name} flower arrangement`}
          loading="lazy"
          onError={event => { event.currentTarget.src = "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=800&q=85"; }}
        />
        {(outOfStock || product.tag) && <span className={`product-tag ${outOfStock ? "product-tag-out" : ""}`}>{outOfStock ? "Out of stock" : product.tag}</span>}
        <span className="quick-view">View details <ArrowRight size={14} /></span>
      </Link>
      <FavouriteButton product={product} />
      <div className="product-info">
        <div>
          <Link to={`/product/${product.id}`} className="product-name">{product.name}</Link>
          <p className="product-desc">{product.shortDescription || product.description}</p>
        </div>
        <button
          className={`add-small ${justAdded ? "is-added" : ""}`}
          disabled={outOfStock}
          onClick={handleAdd}
          aria-label={outOfStock ? `${product.name} is out of stock` : justAdded ? `${product.name} added to bag` : `Add ${product.name}`}
        >
          <AnimatePresence mode="wait" initial={false}>
            {justAdded ? (
              <motion.span key="added" initial={reduceMotion ? false : { scale: 0.4, rotate: -20, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>
                <Check size={17} />
              </motion.span>
            ) : (
              <motion.span key="add" initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>
                {outOfStock ? "–" : <Plus size={17} />}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
      <div className="product-price">
        {money(product.price)}
        {product.regularPrice && product.regularPrice > product.price && <del>{money(product.regularPrice)}</del>}
      </div>
    </motion.article>
  );
}