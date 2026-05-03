/**
 * Inline script for next/script `beforeInteractive` — sets `html.dark` from cookie,
 * then localStorage `flood-theme`, then `prefers-color-scheme` when theme is `system` or missing.
 */
export const FLOOD_THEME_KEY = "flood-theme";
export const FLOOD_THEME_COOKIE = "flood-theme";

export function getThemeInitScript(): string {
  return `(function(){
  try {
    var k='${FLOOD_THEME_KEY}';
    var d=document.documentElement;
    var c=document.cookie.split('; ').find(function(r){return r.indexOf(k+'=')===0;});
    var v=c?decodeURIComponent(c.split('=').slice(1).join('=')):null;
    if(v==null||v===''){try{v=localStorage.getItem(k);}catch(e){}}
    if(v==null||v===''){try{v=localStorage.getItem('flood-crm-theme');}catch(e){}}
    var dark=false;
    if(v==='dark')dark=true;
    else if(v==='light')dark=false;
    else{if(window.matchMedia('(prefers-color-scheme: dark)').matches)dark=true;}
    d.classList.toggle('dark',dark);
  }catch(e){}
})();`;
}
