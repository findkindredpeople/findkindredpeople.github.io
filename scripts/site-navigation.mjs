const version='20261031-1';
const pairs={'berlin-activities.html':'berlin-aktivitaeten.html','berlin-this-week.html':'berlin-diese-woche.html','friendship-planner.html':'freundschaftsplaner.html','compare-activities.html':'angebote-vergleichen.html'};
const reverse=Object.fromEntries(Object.entries(pairs).map(([en,de])=>[de,en]));
const escape=value=>String(value).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
export function navigationMarkup(path,language='en',mainId='main-content'){
 const de=language==='de';
 const words=de?{skip:'Zum Inhalt',menu:'Menü',close:'Schließen',nav:'Hauptnavigation',activities:'Aktivitäten',guides:'Ratgeber (EN)',tools:'Werkzeuge',community:'Community',safety:'Sicherheit (EN)',about:'Über Kindred (EN)',planner:'Wochenplaner',compare:'Angebote vergleichen',daily:'Daily (EN)',dice:'Social Dice (EN)',preferences:'Vorlieben vergleichen (EN)'}:{skip:'Skip to content',menu:'Menu',close:'Close',nav:'Main navigation',activities:'Activities',guides:'Guides',tools:'Tools',community:'Community',safety:'Safety',about:'About',planner:'Weekly planner',compare:'Compare activities',daily:'Daily',dice:'Social Dice',preferences:'Friendship preferences'};
 const activityPath=de?'berlin-aktivitaeten.html':'berlin-activities.html';
 const toolItems=[[de?'freundschaftsplaner.html':'friendship-planner.html',words.planner],[de?'angebote-vergleichen.html':'compare-activities.html',words.compare],['daily.html',words.daily],['play.html',words.dice],['compatibility.html',words.preferences]];
 const group=path.startsWith('guide-')||path==='guides.html'?'guides':/^berlin-|^deutsch-ueben/.test(path)?'activities':toolItems.some(([file])=>file===path)?'tools':/^(community|forum|meetup)/.test(path)?'community':/safety/.test(path)?'safety':path==='about.html'?'about':'';
 const link=(href,label,section='')=>'<a class="site-nav-link'+(section&&group===section?' is-active':'')+'" href="'+href+'"'+(href===path?' aria-current="page"':'')+'>'+label+'</a>';
 const other=pairs[path]||reverse[path];
 const languageLink=other?'<a class="site-language" id="tool-language" href="'+other+'" lang="'+(de?'en':'de')+'" aria-label="'+(de?'Diese Seite auf Englisch':'Read this page in German')+'">'+(de?'English':'Deutsch')+'</a>':'';
 return '<a class="site-skip-link" href="#'+escape(mainId)+'">'+words.skip+'</a><header class="site-header" data-site-header data-menu-label="'+words.menu+'" data-close-label="'+words.close+'"><div class="site-header-inner"><a class="site-brand" href="index.html" aria-label="Kindred '+(de?'Startseite':'home')+'"><img src="kindred-icon.svg" width="40" height="40" alt=""><span>Kindred</span></a><button class="site-menu-toggle" type="button" aria-expanded="false" aria-controls="site-navigation"><svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span data-menu-text>'+words.menu+'</span></button><nav class="site-navigation" id="site-navigation" aria-label="'+words.nav+'">'+link(activityPath,words.activities,'activities')+link('guides.html',words.guides,'guides')+'<details class="site-tools'+(group==='tools'?' is-active':'')+'"><summary>'+words.tools+'</summary><div class="site-tools-panel">'+toolItems.map(([href,label])=>link(href,label)).join('')+'</div></details>'+link('community.html',words.community,'community')+link('safety.html',words.safety,'safety')+link('about.html',words.about,'about')+languageLink+'</nav></div></header>';
}
export function decoratePage(html,path){
 if(!/<header\b/i.test(html)||!/<main\b/i.test(html))return html;
 const language=html.match(/<html[^>]*\blang=["']([^"']+)/i)?.[1]||'en';
 let mainId=html.match(/<main[^>]*\bid=["']([^"']+)/i)?.[1];
 if(!mainId){mainId='main-content';html=html.replace(/<main\b/i,'<main id="'+mainId+'"');}
 html=html.replace(/<main\b([^>]*)>/i,(all,attrs)=>/\btabindex=/.test(attrs)?all:'<main'+attrs+' tabindex="-1">');
 html=html.replace(/<a\b[^>]*class=["'](?:skip-link|site-skip-link)["'][^>]*>[\s\S]*?<\/a>/i,'');
 html=html.replace(/<header\b[^>]*>[\s\S]*?<\/header>/i,navigationMarkup(path,language,mainId));
 html=html.replace(/<link\b[^>]*href=["']site-navigation\.css[^"']*["'][^>]*>\s*/g,'').replace(/<script\b[^>]*src=["']site-navigation\.js[^"']*["'][^>]*>[\s\S]*?<\/script>\s*/g,'');
 return html.replace('</head>','<link rel="stylesheet" href="site-navigation.css?v='+version+'"><script src="site-navigation.js?v='+version+'" defer></script></head>');
}
