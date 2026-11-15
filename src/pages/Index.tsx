import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Flower2, Instagram, Menu, Search, ShoppingBag, X } from "lucide-react";
import { useStore, type Product } from "../store";
import { loadProducts } from "../lib/store-api";
import { ProductGrid } from "../storefront";
import { Reveal } from "../components/motion";
import CartDrawer from "../components/CartDrawer";
import "../App.css";

const photos = {
  hero: "https://images.unsplash.com/photo-1520763185298-1b434c919102?auto=format&fit=crop&w=1600&q=85",
  story: "https://images.unsplash.com/photo-1457089328109-e5d9bd499191?auto=format&fit=crop&w=1000&q=85",
  shop: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=900&q=85",
};

const categories = [
  { title: "Hand-tied bouquets", note: "Made slowly, by hand", image: "https://images.unsplash.com/photo-1520763185298-1b434c919102?auto=format&fit=crop&w=900&q=85", to: "/shop" },
  { title: "Roses, always", note: "A classic, thoughtfully done", image: "https://images.unsplash.com/photo-1494972308805-463bc619d34e?auto=format&fit=crop&w=900&q=85", to: "/shop?category=Roses" },
  { title: "In season", note: "The best of right now", image: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=900&q=85", to: "/shop?category=Seasonal%20Flowers" },
  { title: "Flower boxes", note: "A gift to remember", image: "https://images.unsplash.com/photo-1487530811176-3780de880c2d?auto=format&fit=crop&w=900&q=85", to: "/shop?category=Flower%20Boxes" },
];

export default function Index() {
  const store = useStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [drawer, setDrawer] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
    const reduceMotion = useReducedMotion();
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 720], [0, 58]);

  useEffect(() => {
    let active = true;
    loadProducts().then(items => {
      if (active) setProducts(items.filter(item => item.available));
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const count = store.cart.reduce((total, item) => total + item.quantity, 0);
  const visibleProducts = useMemo(() => products.filter(product => product.name.toLowerCase().includes(query.toLowerCase())), [products, query]);
  const image = (src: string, alt: string, className = "") => (
    <img src={src} alt={alt} className={className} loading="lazy" onError={event => { event.currentTarget.src = photos.shop; }} />
  );

  return (
    <div className="site-shell">
      <div className="announcement">Fresh flowers, thoughtfully arranged <span>·</span> Same-day delivery available</div>
      <header className="site-header">
        <button className="mobile-menu-button" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Open navigation" aria-expanded={mobileMenu}>{mobileMenu ? <X /> : <Menu />}</button>
        <Link to="/" className="wordmark"><span className="logo-flower"><Flower2 size={24} /></span><span>Bloom <i>&</i> Petal</span></Link>
        <nav className={mobileMenu ? "main-nav is-open" : "main-nav"} onClick={() => setMobileMenu(false)}>
          <Link to="/">Home</Link>
          <Link to="/shop">Shop</Link>
          <Link to="/shop">Bouquets</Link>
          <Link to="/shop">Flowers</Link>
          <Link to="/#occasions">Occasions</Link>
          <Link to="/about">Our story</Link>
          <Link to="/contact">Contact</Link>
        </nav>
        <div className="header-actions">
          <button onClick={() => setSearchOpen(!searchOpen)} aria-label="Search" aria-expanded={searchOpen}><Search size={19} /></button>
          <button className="bag-button" onClick={() => setDrawer(true)} aria-label="Shopping bag">
            <ShoppingBag size={20} />
            <AnimatePresence>
              {count > 0 && <motion.span className="bag-count" key={count} initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>{count}</motion.span>}
            </AnimatePresence>
          </button>
        </div>
      </header>
      <AnimatePresence initial={false}>
        {searchOpen && (
          <motion.div
            className="search-bar"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <Search size={17} />
            <input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder="Find something lovely…" aria-label="Search flowers" />
            <button onClick={() => setSearchOpen(false)} aria-label="Close search"><X size={17} /></button>
            {query && (
              <div className="search-results">
                {visibleProducts.length ? visibleProducts.slice(0, 5).map(product => (
                  <Link key={product.id} to={`/product/${product.id}`} onClick={() => setSearchOpen(false)}>
                    {product.name} <span>AED {product.price}</span>
                  </Link>
                )) : <span>No flowers found just yet.</span>}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <span className="eyebrow hero-fade" style={{ animationDelay: "0.04s" }}>A LITTLE BEAUTY, EVERY DAY</span>
            <h1>
              <span className="hero-line" style={{ animationDelay: "0.1s" }}>Flowers that speak</span>
              <span className="hero-line" style={{ animationDelay: "0.24s" }}>when words aren't</span>
              <span className="hero-line" style={{ animationDelay: "0.38s" }}><em>enough.</em></span>
            </h1>
            <p className="hero-fade" style={{ animationDelay: "0.52s" }}>Thoughtfully arranged blooms, handpicked with love and delivered fresh to your doorstep.</p>
            <div className="hero-buttons hero-fade" style={{ animationDelay: "0.64s" }}>
              <Link className="button button-dark" to="/shop">Shop bouquets <ArrowRight size={16} /></Link>
              <Link className="text-link" to="/shop">Explore flowers <ArrowRight size={15} /></Link>
            </div>
            <div className="hero-note hero-fade" style={{ animationDelay: "0.76s" }}><span className="note-rule" /> Arranged fresh, delivered with care</div>
          </div>
          <div className="hero-visual">
            <motion.div className="hero-parallax" style={reduceMotion ? undefined : { y: heroY }}>
              <img className="hero-image hero-zoom" src={photos.hero} alt="Hand-tied bouquet of blush roses, white tulips and fresh greenery" />
            </motion.div>
            <span className="image-caption">A little something for someone special</span>
            <span className="hero-index">01 <i>—</i> 04</span>
          </div>
        </section>

        <Reveal className="category-section section-wrap">
          <div className="section-heading">
            <div><span className="eyebrow">FIND YOUR FLOWERS</span><h2>Something for <em>every feeling.</em></h2></div>
            <Link className="text-link" to="/shop">View all flowers <ArrowRight size={15} /></Link>
          </div>
          <div className="category-grid">
            {categories.map((category, index) => (
              <Link to={category.to} className={`category-card category-${index + 1}`} key={category.title}>
                {image(category.image, `${category.title} flower category`)}
                <div className="category-copy">
                  <span>{category.note}</span>
                  <h3>{category.title}</h3>
                  <span className="category-arrow"><ArrowRight size={17} /></span>
                </div>
              </Link>
            ))}
          </div>
        </Reveal>

        <Reveal className="bestsellers section-wrap">
          <div className="section-heading">
            <div><span className="eyebrow">THE ONES YOU LOVE</span><h2>Our most <em>loved.</em></h2></div>
            <Link className="text-link" to="/shop">Shop all bouquets <ArrowRight size={15} /></Link>
          </div>
          <ProductGrid products={products.slice(0, 4)} onAdd={() => setDrawer(true)} />
        </Reveal>

        <Reveal className="story-section">
          <div className="story-image">{image(photos.story, "Florist arranging fresh flowers at her worktable")}</div>
          <div className="story-copy">
            <span className="eyebrow">A FLOWER SHOP, WITH HEART</span>
            <h2>Not just flowers.<br /><em>Little moments</em><br />of happiness.</h2>
            <p>Every bouquet is thoughtfully designed using fresh, carefully selected flowers. We believe even the smallest gesture deserves something beautiful.</p>
            <Link to="/about" className="button button-outline">A little about us <ArrowRight size={15} /></Link>
            <span className="story-script">Made by hand, with love</span>
          </div>
        </Reveal>

        <Reveal className="occasion-section section-wrap" id="occasions">
          <div className="section-heading">
            <div><span className="eyebrow">FOR ALL OF LIFE'S LITTLE MOMENTS</span><h2>Give them a <em>reason to smile.</em></h2></div>
          </div>
          <div className="occasion-grid">
            {[
              { name: "Birthdays", img: "https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=760&q=85" },
              { name: "Anniversaries", img: "https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=760&q=85" },
              { name: "Weddings", img: "https://images.unsplash.com/photo-1523438885200-e635ba2c371e?auto=format&fit=crop&w=760&q=85" },
              { name: "Just because", img: "https://images.unsplash.com/photo-1520763185298-1b434c919102?auto=format&fit=crop&w=760&q=85" },
            ].map((occasion, index) => (
              <Link className="occasion-card" to="/shop" key={occasion.name}>
                {image(occasion.img, `${occasion.name} flowers`)}
                <span>0{index + 1} / OCCASION</span>
                <h3>{occasion.name}</h3>
                <ArrowRight size={17} />
              </Link>
            ))}
          </div>
        </Reveal>

        <Reveal className="quote-section">
          <span className="eyebrow">KIND WORDS, KEPT CLOSE</span>
          <div className="quote-mark">“</div>
          <blockquote>Every detail felt personal. The flowers arrived looking as though they had just been picked from a garden.</blockquote>
          <span className="quote-byline">— A happy customer, Dubai</span>
          <div className="quote-dots"><i /><i className="active" /><i /></div>
        </Reveal>

        <Reveal className="newsletter">
          <div><span className="eyebrow">A NOTE FROM THE FLOWER SHOP</span><h2>Let a little beauty<br />into your <em>inbox.</em></h2></div>
          <form onSubmit={event => { event.preventDefault(); alert("Thank you for joining our little flower note."); }}>
            <label htmlFor="newsletter-email">Occasional notes, fresh flowers, and lovely things.</label>
            <div className="newsletter-input"><input id="newsletter-email" type="email" required placeholder="Your email address" /><button aria-label="Subscribe"><ArrowRight size={18} /></button></div>
            <small>By subscribing, you agree to receive the occasional note from us.</small>
          </form>
        </Reveal>
      </main>

      <footer className="site-footer">
        <div className="footer-main">
          <div className="footer-brand">
            <Link to="/" className="wordmark"><span className="logo-flower"><Flower2 size={22} /></span><span>Bloom <i>&</i> Petal</span></Link>
            <p>Flowers for the everyday and the extraordinary, arranged with care.</p>
            <a className="instagram-link" href="https://instagram.com" target="_blank" rel="noreferrer"><Instagram size={16} /> Find us on Instagram</a>
          </div>
          <div className="footer-links">
            <div><h4>Explore</h4><Link to="/shop">All flowers</Link><Link to="/shop">Bouquets</Link><Link to="/builder">Build your bouquet</Link><Link to="/shop">Flower boxes</Link></div>
            <div><h4>Here to help</h4><Link to="/delivery">Delivery information</Link><Link to="/track">Track an order</Link><Link to="/contact">Contact us</Link><Link to="/about">Our story</Link></div>
            <div><h4>Say hello</h4><Link to="/contact">Contact us</Link><Link to="/admin">Shop admin demo</Link></div>
          </div>
        </div>
        <div className="footer-bottom"><span>© 2025 Bloom & Petal.</span><span>Thoughtfully arranged, always.</span></div>
      </footer>

      <CartDrawer open={drawer} onClose={() => setDrawer(false)} />
          </div>
        );
      }