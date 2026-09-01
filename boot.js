/*
 * Chargeur de version d'Orapa Mine.
 *
 * La page peut rester brièvement en cache chez GitHub Pages alors que
 * version.json a déjà changé. On charge donc toujours le moteur et
 * l'application à partir de la même version publiée. Ce fichier ne lit ni
 * n'écrit aucune donnée de partie ou de compte dans le navigateur.
 */
(function(){
  'use strict';
  const FALLBACK_VERSION='20260901-0007';

  function scriptUrl(file,version){
    return `${file}?v=${encodeURIComponent(version)}`;
  }
  function loadScript(url){
    return new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src=url;
      script.async=false;
      script.onload=resolve;
      script.onerror=()=>reject(new Error(`Impossible de charger ${url}`));
      document.head.appendChild(script);
    });
  }
  function showBootError(){
    const message=document.createElement('div');
    message.setAttribute('role','alert');
    message.style.cssText='position:fixed;inset:20px;z-index:9999;display:grid;place-items:center;padding:20px;text-align:center;color:#efe6d6;background:#120e0a;font:600 16px system-ui,sans-serif;';
    message.textContent='Impossible de charger Orapa Mine. Vérifie ta connexion puis actualise la page.';
    document.body.appendChild(message);
  }
  async function start(){
    let version=FALLBACK_VERSION;
    try{
      const response=await fetch(`version.json?_=${Date.now()}`,{cache:'no-store'});
      if(response.ok){
        const data=await response.json();
        if(data?.version)version=String(data.version);
      }
    }catch(_error){
      // Une version connue reste disponible hors ligne ou pendant une brève
      // indisponibilité de GitHub Pages.
    }
    try{
      await loadScript(scriptUrl('engine-core.js',version));
      await loadScript(scriptUrl('app.js',version));
    }catch(error){
      console.error('Échec du démarrage d’Orapa Mine.',error);
      showBootError();
    }
  }
  void start();
})();
