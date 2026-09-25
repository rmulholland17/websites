/* Shared by index.html and reviews.html: review cards, hero quote rotator, rental request form. */
(function(){
  var EMAIL = "service@arcticacrentals.com", PHONE = "561-898-2665";
  var GOOGLE = "https://www.google.com/maps/place/Arctic+AC+Rentals/data=!4m7!3m6!1s0x651753aedeba04d5:0xec2a28a2fdd8a228!8m2!3d26.792293!4d-80.4301795!16s%2Fg%2F11njnrll6p!19sChIJ1QS63q5TF2URKKLY_aIoKuw";

  // Quoted from the public Google listing (source: research/source-notes.md). Add new ones here.
  var REVIEWS = [
    {id:"gregg", name:"Gregg P.", who:"Homeowner", stars:5,
     short:"Had 2 portable units set up within an hour!",
     text:"Great service! My AC went down and Arctic had 2 portable units set up within an hour! Professional and courteous."},
    {id:"alice", name:"Alice D.", who:"Condo manager, Juno Beach", stars:5,
     short:"They delivered and set up units during the night.",
     text:"… They delivered and set up portable air conditioning units during the night, allowing us to maintain comfortable temperatures until our HVAC contractor could complete the repairs. … The equipment was clean, quiet, and worked exactly as promised. …"},
    {id:"eric", name:"Eric H.", who:"Homeowner, Palm Beach", stars:5,
     short:"We stayed home instead of scrambling for a hotel.",
     text:"… Greg and Joann were the best and delivered multiple portable AC units the same day. The setup was fast, professional, and unintrusive. Most importantly, it allowed us to remain comfortably in our home instead of scrambling to find a hotel or stay with friends while waiting for repairs. …"},
    {id:"heather", name:"Heather P.", who:"Homeowner, Jupiter", stars:5,
     short:"Clean, efficient units running in no time.",
     text:"When our air conditioner unexpectedly failed during a hot Jupiter weekend, Arctic AC Rentals came to the rescue. Their team responded quickly, delivered several clean and efficient portable AC units, and had them running in no time. …"}
  ];

  function el(tag, cls, text){ var e = document.createElement(tag); if(cls) e.className = cls; if(text != null) e.textContent = text; return e; }
  function stars(n){ var s = el("span","stars","★★★★★".slice(0,n)); s.setAttribute("aria-label", n + " out of 5 stars"); return s; }

  // Review cards: <div data-reviews data-skip="alice"> renders every review not skipped.
  document.querySelectorAll("[data-reviews]").forEach(function(box){
    var skip = (box.getAttribute("data-skip") || "").split(",");
    REVIEWS.filter(function(r){ return skip.indexOf(r.id) < 0; }).forEach(function(r){
      var f = el("figure","quote"), bq = el("blockquote"), cap = el("figcaption");
      bq.textContent = "“" + r.text + "”";
      cap.appendChild(el("b", null, r.name));
      cap.appendChild(el("span", null, r.who + " · Google review"));
      f.appendChild(stars(r.stars)); f.appendChild(bq); f.appendChild(cap);
      box.insertBefore(f, box.querySelector(".quote.cta"));
    });
  });

  // Hero: rotate short quotes from real reviews.
  var hq = document.getElementById("hero-quote");
  if(hq){
    var i = 0, txt = hq.querySelector(".hq-text"), by = hq.querySelector(".hq-by");
    var show = function(){ var r = REVIEWS[i]; txt.textContent = "“" + r.short + "”"; by.textContent = r.name + ", " + r.who; };
    show();
    if(!matchMedia("(prefers-reduced-motion: reduce)").matches){
      setInterval(function(){
        hq.classList.add("out");
        setTimeout(function(){ i = (i + 1) % REVIEWS.length; show(); hq.classList.remove("out"); }, 350);
      }, 5500);
    }
  }

  // Copy-email buttons, for people who don't use Gmail.
  function copy(text, btn){
    var done = function(){ var o = btn.textContent; btn.textContent = "Copied"; setTimeout(function(){ btn.textContent = o; }, 1600); };
    try { navigator.clipboard.writeText(text).then(done, function(){ prompt("Copy this:", text); }); }
    catch(e){ prompt("Copy this:", text); }
  }
  document.querySelectorAll("[data-copy]").forEach(function(b){
    b.addEventListener("click", function(){ copy(b.getAttribute("data-copy"), b); });
  });

  // Call buttons. Inside an embedded preview (e.g. Claude Artifacts) the sandboxed frame blocks
  // tel: navigation, so hand it to a new window. On computers, where tel: often does nothing,
  // also show the number so the visitor can dial it.
  var toast;
  function showNumber(){
    if(!toast){ toast = el("div","toast"); toast.setAttribute("role","status"); document.body.appendChild(toast); }
    toast.textContent = "Call dispatch: " + PHONE + " (open 24/7)";
    toast.classList.add("on"); clearTimeout(toast._t);
    toast._t = setTimeout(function(){ toast.classList.remove("on"); }, 6000);
  }
  var framed = (function(){ try { return window.top !== window.self; } catch(e){ return true; } })();
  var desktop = matchMedia("(hover: hover) and (pointer: fine)").matches;
  document.querySelectorAll('a[href^="tel:"]').forEach(function(a){
    a.addEventListener("click", function(ev){
      if(desktop) showNumber();
      if(framed){ ev.preventDefault(); try { window.open(a.href, "_blank"); } catch(e){} }
    });
  });

  // Rental request form. On the real domain it posts to Netlify Forms; elsewhere (previews) it
  // opens a Gmail draft and always shows a fallback so a request is never silently lost.
  var LIVE = /(^|\.)arcticacrentals\.com$/.test(location.hostname);
  document.querySelectorAll("form.req").forEach(function(f){
    f.addEventListener("submit", function(ev){
      if(LIVE) return;
      ev.preventDefault();
      var d = new FormData(f);
      var name = (d.get("name")||"").trim(), phone = (d.get("phone")||"").trim(), where = (d.get("where")||"").trim();
      var need = d.get("need") || "";
      var SITUATION = {
        "AC is out at my home": "My AC just went out at home and I'd like to rent a portable unit to get us through until it's fixed.",
        "AC is out in a condo or rental": "The AC is out in my condo/rental and I'd like to rent a portable unit to keep it cool until it's repaired.",
        "Need extra cooling for a room": "I need extra cooling for a room and I'd like to rent a portable AC unit.",
        "Planning ahead": "I'm planning ahead and would like to set up a portable AC rental."
      };
      var body = "Hi Arctic AC Rentals,\n\n" +
                 (SITUATION[need] || "I'd like to rent a portable AC unit.") + "\n\n" +
                 "I'm located at " + (where || "[add your address]") + ". " +
                 "What's the soonest you can deliver and set it up? The best way to reach me is " + (phone || "[your phone]") + ".\n\n" +
                 "Thank you,\n" + (name || "") + "\n\n" +
                 "---\nName: " + name + "\nPhone: " + phone + "\nAddress: " + where + "\nSituation: " + need;
      // Riley's call: compose in Gmail (web) instead of launching a desktop email app via mailto.
      var href = "https://mail.google.com/mail/?view=cm&fs=1&to=" + EMAIL + "&su=" + encodeURIComponent("AC rental request: " + (d.get("where")||d.get("name")||"")) +
                 "&body=" + encodeURIComponent(body);
      try { window.open(href, "_blank", "noopener"); } catch(e){}
      var msg = f.querySelector(".req-done");
      msg.hidden = false;
      msg.querySelector("pre").textContent = body;
      msg.querySelector("[data-copy-body]").onclick = function(){ copy("To: " + EMAIL + "\n\n" + body, this); };
    });
  });
})();
