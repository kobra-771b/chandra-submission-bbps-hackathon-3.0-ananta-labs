(function(){
  var OK={'en-US':'en-US','en-UK':'en-UK','en-GB':'en-UK','en-IN':'en-IN'};
  var HTML={'en-US':'en-US','en-UK':'en-GB','en-IN':'en-IN'};
  var key=(new URLSearchParams(location.search).get('lang')||'').toLowerCase();
  var lang='en-US';
  Object.keys(OK).forEach(function(k){if(k.toLowerCase()===key)lang=OK[k];});
  var root=document.documentElement;
  root.setAttribute('data-lang',lang);root.setAttribute('lang',HTML[lang]);
  function carry(){
    document.querySelectorAll('a[data-keep-lang]').forEach(function(a){
      var u=new URL(a.getAttribute('href'),location.href);u.searchParams.set('lang',lang);
      a.setAttribute('href',u.pathname+u.search+u.hash);
    });
    document.querySelectorAll('[data-set-lang]').forEach(function(b){
      var l=b.getAttribute('data-set-lang');
      b.setAttribute('aria-current',String(l===lang));
      b.setAttribute('href','?lang='+l+location.hash);
    });
  }
  document.addEventListener('DOMContentLoaded',function(){
    carry();
    var s=[].slice.call(document.querySelectorAll('.slide')),i=0;
    function go(d){if(!s.length)return;i=Math.max(0,Math.min(s.length-1,i+d));s[i].scrollIntoView({behavior:'smooth'});}
    var p=document.getElementById('prev'),n=document.getElementById('next');
    if(p)p.onclick=function(){go(-1)};if(n)n.onclick=function(){go(1)};
    document.addEventListener('keydown',function(e){
      if(e.key==='ArrowRight'||e.key==='PageDown'||e.key===' ')go(1);
      if(e.key==='ArrowLeft'||e.key==='PageUp')go(-1);
    });
  });
})();
