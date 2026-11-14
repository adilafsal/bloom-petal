import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Layout } from "../storefront";
import { useStore } from "../store";

const flowers = ["Red roses", "Pink roses", "White roses", "Tulips", "Lilies", "Sunflowers", "Carnations", "Baby's breath"];
const colors = ["Soft pink & ivory", "Classic red", "Fresh whites", "Garden mix", "Sunny yellows"];
const sizes = { Small: 139, Medium: 189, Large: 259 };
const wrappingStyles = ["Classic cream", "Dusty pink", "Kraft paper", "Elegant white"];
const giftOptions = [{ name: "Greeting card", price: 12 }, { name: "Gift box", price: 35 }, { name: "Ribbon", price: 8 }, { name: "Small teddy bear", price: 45 }];

export default function NeonBuilder() {
  const { add } = useStore();
  const [selectedFlowers, setSelectedFlowers] = useState<string[]>([]);
  const [color, setColor] = useState(colors[0]);
  const [size, setSize] = useState<keyof typeof sizes>("Medium");
  const [wrapping, setWrapping] = useState(wrappingStyles[0]);
  const [extras, setExtras] = useState<string[]>([]);
  const [giftMessage, setGiftMessage] = useState("");
  const [added, setAdded] = useState(false);
  const total = sizes[size] + extras.reduce((sum, name) => sum + (giftOptions.find(option => option.name === name)?.price ?? 0), 0);
  const toggle = (value: string, values: string[], setValues: (items: string[]) => void) => setValues(values.includes(value) ? values.filter(item => item !== value) : [...values, value]);

  function addToBag() {
    if (!selectedFlowers.length) return;
    const selections = { flowers: selectedFlowers, color, size, wrapping, extras, giftMessage };
    add({ id: 900000 + Math.floor(Math.random() * 1_000_000_000), name: "Custom bouquet", price: total, category: "Custom bouquet", description: selectedFlowers.join(", "), image: "https://images.unsplash.com/photo-1520763185298-1b434c919102?auto=format&fit=crop&w=800&q=85" }, size, JSON.stringify(selections));
    setAdded(true);
  }

  return <Layout><main className="builder-page"><div className="catalog-hero"><span className="eyebrow">A BOUQUET, YOUR WAY</span><h1>Make it <em>personal.</em></h1><p>Choose flowers and finishing touches. Our florists will bring your selection to life.</p></div><div className="builder-grid"><div className="builder-form">
    <section><span className="step-number">01</span><div><h2>Pick your flowers</h2><p>Choose at least one stem style.</p><div className="choice-grid">{flowers.map(flower=><button key={flower} className={selectedFlowers.includes(flower)?"choice selected":"choice"} aria-pressed={selectedFlowers.includes(flower)} onClick={()=>toggle(flower,selectedFlowers,setSelectedFlowers)}>{flower}</button>)}</div></div></section>
    <section><span className="step-number">02</span><div><h2>Choose your palette</h2><p>Pick the mood for the arrangement.</p><select value={color} onChange={event=>setColor(event.target.value)}>{colors.map(option=><option key={option}>{option}</option>)}</select></div></section>
    <section><span className="step-number">03</span><div><h2>Choose a size</h2><p>Base pricing is configured on the server.</p><div className="size-options">{Object.entries(sizes).map(([label,price])=><button key={label} className={size===label?"chosen":""} onClick={()=>setSize(label as keyof typeof sizes)}><span>{label}</span><small>AED {price}</small></button>)}</div></div></section>
    <section><span className="step-number">04</span><div><h2>Finishing touches</h2><p>Choose your wrap and optional gifts.</p><select value={wrapping} onChange={event=>setWrapping(event.target.value)}>{wrappingStyles.map(option=><option key={option}>{option}</option>)}</select><div className="builder-extras">{giftOptions.map(option=><label key={option.name}><input type="checkbox" checked={extras.includes(option.name)} onChange={()=>toggle(option.name,extras,setExtras)}/>{option.name} (+AED {option.price})</label>)}</div></div></section>
    <section><span className="step-number">05</span><div><h2>Add a personal message</h2><p>We'll include a handwritten note.</p><textarea maxLength={500} value={giftMessage} onChange={event=>setGiftMessage(event.target.value)} placeholder="Your message (optional)"/></div></section>
  </div><aside className="builder-summary"><span className="eyebrow">YOUR CUSTOM BOUQUET</span><div className="builder-bouquet">✳</div><h2>{selectedFlowers.length?selectedFlowers.join(", "):"Choose your blooms"}</h2><p>{color} · {size} · {wrapping}</p><dl>{extras.map(extra=><div key={extra}><dt>Extra</dt><dd>{extra}</dd></div>)}</dl><div className="builder-total"><span>Estimated total</span><strong>AED {total}</strong></div><button className="button button-dark checkout-button" disabled={!selectedFlowers.length} onClick={addToBag}>{added?"Added to your bag":"Add bouquet to bag"} <ArrowRight size={15}/></button><small className="validation-note">Final custom-bouquet pricing is verified by the server at checkout.</small></aside></div></main></Layout>;
}
