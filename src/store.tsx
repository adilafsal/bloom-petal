import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
export type Product={id:string|number;name:string;price:number;category:string;description:string;image:string;tag?:string;available?:boolean;stockQuantity?:number|null;featured?:boolean;regularPrice?:number;salePrice?:number|null;shortDescription?:string;categoryId?:string};
export type Item={product:Product;quantity:number;size:string;custom?:string};
export const inventory:Product[]=[
{id:1,name:"The Blush Edit",price:149,category:"Roses",description:"Garden roses and delicate seasonal stems, gathered in soft blush tones.",image:"https://images.unsplash.com/photo-1494972308805-463bc619d34e?auto=format&fit=crop&w=800&q=85",tag:"Bestseller"},
{id:2,name:"Sunday Morning",price:199,category:"Mixed Bouquets",description:"A generous, sunlit gathering of garden favourites and fresh greenery.",image:"https://images.unsplash.com/photo-1525310072745-f49212b5ac6d?auto=format&fit=crop&w=800&q=85",tag:"Loved"},
{id:3,name:"Rose Reverie",price:129,category:"Roses",description:"Velvety pink roses with a quiet, romantic kind of charm.",image:"https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=800&q=85"},
{id:4,name:"White Romance",price:179,category:"Lilies",description:"Elegant ivory blooms arranged with graceful, natural movement.",image:"https://images.unsplash.com/photo-1508610048659-a06b669e3321?auto=format&fit=crop&w=800&q=85"},
{id:5,name:"Golden Hour",price:159,category:"Sunflowers",description:"Warm golden blooms and garden textures for brighter days.",image:"https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=800&q=85"},
{id:6,name:"Garden Affair",price:189,category:"Mixed Bouquets",description:"A just-picked mix inspired by the last flowers of the season.",image:"https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&w=800&q=85"},
{id:7,name:"Softly Yours",price:139,category:"Tulips",description:"A graceful bundle of fresh tulips in gentle, changing shades.",image:"https://images.unsplash.com/photo-1520637836862-4d197d17c11a?auto=format&fit=crop&w=800&q=85"},
{id:8,name:"Petal & Pearl",price:169,category:"Flower Boxes",description:"A considered flower-box arrangement, made to make an impression.",image:"https://images.unsplash.com/photo-1487530811176-3780de880c2d?auto=format&fit=crop&w=800&q=85"},
{id:9,name:"Peony Season",price:219,category:"Seasonal Flowers",description:"The fleeting beauty of peonies, paired with airy garden stems.",image:"https://images.unsplash.com/photo-1563241527-3004b7be0ffd?auto=format&fit=crop&w=800&q=85"},
{id:10,name:"Little Cloud",price:119,category:"Mixed Bouquets",description:"Delicate baby's breath gathered into a cloud-soft bouquet.",image:"https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=800&q=85"},
{id:11,name:"Ivory Hour",price:189,category:"Lilies",description:"Long-stemmed white lilies with graceful foliage and a gentle scent.",image:"https://images.unsplash.com/photo-1508610048659-a06b669e3321?auto=format&fit=crop&w=800&q=85"},
{id:12,name:"Crimson Notes",price:199,category:"Roses",description:"A dozen classic red roses, wrapped simply in soft cream paper.",image:"https://images.unsplash.com/photo-1518895949257-7621c3c786d7?auto=format&fit=crop&w=800&q=85"}];
export const getProducts=()=>{try{return [...inventory,...JSON.parse(localStorage.getItem("bp-extra-products")||"[]") as Product[]]}catch{return inventory}};
type StoreType={cart:Item[];add:(p:Product,size?:string,custom?:string)=>void;quantity:(id:number,change:number)=>void;remove:(id:number)=>void;clear:()=>void;orders:any[];placeOrder:(data:any)=>string};
const Store=createContext<StoreType|null>(null);
export function StoreProvider({children}:{children:ReactNode}){
  const [cart,setCart]=useState<Item[]>(()=>{try{return JSON.parse(localStorage.getItem("bp-cart")||"[]")}catch{return []}});
  const [orders,setOrders]=useState<any[]>(()=>{try{return JSON.parse(localStorage.getItem("bp-orders")||"[]")}catch{return []}});
  useEffect(()=>localStorage.setItem("bp-cart",JSON.stringify(cart)),[cart]);
  const add=(p:Product,size="Medium",custom?:string)=>setCart(c=>{const found=c.find(i=>i.product.id===p.id&&i.size===size&&i.custom===custom);return found?c.map(i=>i===found?{...i,quantity:i.quantity+1}:i):[...c,{product:p,size,custom,quantity:1}]});
  const quantity=(id:number,n:number)=>setCart(c=>c.map(i=>i.product.id===id?{...i,quantity:i.quantity+n}:i).filter(i=>i.quantity>0));
  const remove=(id:number)=>setCart(c=>c.filter(i=>i.product.id!==id));
  const clear=useCallback(()=>setCart([]),[]);
  const placeOrder=(data:any)=>{const ref=`BP${Date.now().toString().slice(-7)}`;const list=[{...data,ref,status:"Order Received",items:cart,created:new Date().toISOString()},...orders];setOrders(list);localStorage.setItem("bp-orders",JSON.stringify(list));setCart([]);return ref};
  return <Store.Provider value={{cart,add,quantity,remove,clear,orders,placeOrder}}>{children}</Store.Provider>;
}
export const useStore=()=>{const x=useContext(Store);if(!x)throw new Error("StoreProvider is missing");return x};
export const money=(n:number)=>`AED ${n.toFixed(0)}`;
