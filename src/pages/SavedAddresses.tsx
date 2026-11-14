import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Home, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { Layout } from "../storefront";
import { useAuthSession } from "../lib/auth-client";
import "../saved-addresses.css";

type SavedAddress = { id:string; recipient_name:string; phone:string; label:"Home"|"Work"|"Other"; building:string; street:string; area:string; city:string; delivery_instructions:string; is_default:boolean };
type AddressInput = Omit<SavedAddress,"id"|"is_default">;
const empty:AddressInput={recipient_name:"",phone:"",label:"Home",building:"",street:"",area:"",city:"",delivery_instructions:""};
const fields:Array<[keyof AddressInput,string]>=[["recipient_name","Full name"],["phone","Phone number"],["building","Building / villa number"],["street","Street name"],["area","Area"],["city","City"]];

export default function SavedAddresses(){
  const {data,isPending}=useAuthSession();const navigate=useNavigate();
  const [addresses,setAddresses]=useState<SavedAddress[]>([]);const [draft,setDraft]=useState<AddressInput>(empty);const [editing,setEditing]=useState("");const [adding,setAdding]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const request=useCallback(async(url:string,init?:RequestInit)=>{const response=await fetch(url,{...init,headers:{"Content-Type":"application/json",...init?.headers}});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.statusMessage||body.message||"Saved addresses are unavailable.");return body;},[]);
  const load=useCallback(async()=>{const rows=await request("/api/addresses") as SavedAddress[];setAddresses(rows);},[request]);
  useEffect(()=>{if(data?.user)void load().catch(e=>setError(e.message));else if(!isPending)navigate("/auth/sign-in",{replace:true});},[data?.user,isPending,load,navigate]);
  const save=async()=>{setBusy(true);setError("");try{if(editing){await request(`/api/addresses/${editing}`,{method:"PATCH",body:JSON.stringify(draft)});}else{await request("/api/addresses",{method:"POST",body:JSON.stringify({...draft,is_default:addresses.length===0})});}await load();setEditing("");setAdding(false);setDraft(empty);}catch(e){setError(e instanceof Error?e.message:"Could not save address.");}finally{setBusy(false);}};
  const setDefault=async(id:string)=>{try{await request(`/api/addresses/${id}`,{method:"PATCH",body:JSON.stringify({make_default:true})});await load();}catch(e){setError(e instanceof Error?e.message:"Could not set default address.");}};
  const remove=async(id:string)=>{if(!window.confirm("Delete this saved address?"))return;try{await request(`/api/addresses/${id}`,{method:"DELETE"});await load();}catch(e){setError(e instanceof Error?e.message:"Could not delete address.");}};
  const edit=(row:SavedAddress)=>{const {id,is_default,...details}=row;setEditing(id);setAdding(false);setDraft(details);};
  if(isPending||!data?.user)return <Layout><main className="simple-page"><p>Checking your account…</p></main></Layout>;
  return <Layout><main className="simple-page address-book-page"><Link to="/checkout" className="address-back-link"><ArrowLeft size={15}/> Back to checkout</Link><span className="eyebrow">YOUR DETAILS</span><h1>Saved <em>addresses.</em></h1><p className="address-subtitle">Manage the delivery places you use with Bloom & Petal.</p>{error&&<p role="alert" className="tracking-error">{error}</p>}
    <div className="saved-address-grid">{addresses.map(address=><article key={address.id} className="saved-address-card"><div className="address-select static"><span className="address-card-top"><span className="address-label"><Home size={15}/>{address.label}</span>{address.is_default&&<span className="address-default">Default</span>}</span><strong>{address.recipient_name}</strong><span>{address.phone}</span><span>{address.building} · {address.street}</span><span>{address.area}, {address.city}</span>{address.delivery_instructions&&<small>{address.delivery_instructions}</small>}</div><div className="address-actions"><button type="button" onClick={()=>edit(address)}><Pencil size={13}/> Edit</button>{!address.is_default&&<button type="button" onClick={()=>void setDefault(address.id)}>Make default</button>}<button type="button" onClick={()=>void remove(address.id)} aria-label="Delete address"><Trash2 size={13}/></button></div></article>)}</div>
    <button type="button" className="add-address-choice" onClick={()=>{setAdding(true);setEditing("");setDraft(empty);}}><Plus size={17}/> Add a new address</button>
    {(adding||editing)&&<section className="new-address-panel"><h2>{editing?"Edit address":"Add a new address"}</h2><div className="address-form-grid">{fields.slice(0,2).map(([key,label])=><label key={key}>{label}<input value={draft[key]} onChange={e=>setDraft(v=>({...v,[key]:e.target.value}))}/></label>)}<label>Address label<select value={draft.label} onChange={e=>setDraft(v=>({...v,label:e.target.value as AddressInput["label"]}))}><option>Home</option><option>Work</option><option>Other</option></select></label>{fields.slice(2).map(([key,label])=><label key={key}>{label}<input value={draft[key]} onChange={e=>setDraft(v=>({...v,[key]:e.target.value}))}/></label>)}</div><label>Additional delivery instructions<textarea maxLength={500} value={draft.delivery_instructions} onChange={e=>setDraft(v=>({...v,delivery_instructions:e.target.value}))}/></label><button className="address-save-button" type="button" disabled={busy} onClick={()=>void save()}>{busy?"Saving…":editing?"Save changes":"Save address"}</button><button type="button" className="address-cancel-button" onClick={()=>{setAdding(false);setEditing("");}}>Cancel</button></section>}
    {!addresses.length&&!adding&&!editing&&<p className="address-subtitle"><MapPin size={15}/> No saved addresses yet.</p>}
  </main></Layout>;
}
