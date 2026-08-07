const IMAGE_RE = /\b(image|picture|photo|wallpaper|poster|logo|icon|drawing|painting|illustration|artwork|art of|portrait|sketch|avatar|banner|cover|meme|thumbnails?|caricature|cartoon|draw|paint|render|imagine|doodle)\b|छवि|तस्वीर|चित्र|ड्रा|ड्रॉ|आर्ट/;
const OFFICE_RE = /\b(excel|spreadsheet|csv|docx|word (document|doc)|budget|invoice|report|schedule|roster|inventory|timesheet|statement|sheet)\b|बजट|इन्वॉइस|स्प्रेडशीट/;
const CODE_RE = /\b(code|coding|codify|program|programming|script|app|application|website|web ?app|function|python|javascript|js\b|html|css|react|node|api|bot|automation|calculator|todo|game|database|sql|docker|project|repo|component|module|class|algorithm)\b|कोड|प्रोग्राम|कैलकुलेटर/;
const LIVE_RE = /\b(what is|who is|when did|when is|why is|why did|how to|news|latest|today'?s|weather|price|stock|market|score|match|live|current|breaking|forecast|compare|difference between|explain|meaning of|population|election|cricket|football|ipl|traffic|currency)\b|खबर|समाचार|मौसम|कीमत|स्कोर/;

function classify(text) {
  const t = String(text || "").toLowerCase();
  const img = IMAGE_RE.test(t);
  const code = CODE_RE.test(t);
  const office = OFFICE_RE.test(t);
  const live = LIVE_RE.test(t);

  if (img && !code && !office) return "image";
  if (office && !code && !img) return "office";
  if (code) return "code";
  if (live) return "research";
  if (img) return "image";
  return "chat";
}

export { classify };
