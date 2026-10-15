"""Full ÖSYM 2026 tables 3/4 to manifest. xlrd==2.0.2.
Usage: python scripts/osym_extract_all.py TABLO3.xls TABLO4.xls OUTPUT.json
Source rows are reconciled exactly; unclassified rows fail instead of disappearing.
"""
import sys,json,re,hashlib,collections
from pathlib import Path
import xlrd
CITIES='Adana Adıyaman Afyonkarahisar Ağrı Amasya Ankara Antalya Artvin Aydın Balıkesir Bilecik Bingöl Bitlis Bolu Burdur Bursa Çanakkale Çankırı Çorum Denizli Diyarbakır Edirne Elazığ Erzincan Erzurum Eskişehir Gaziantep Giresun Gümüşhane Hakkari Hatay Isparta Mersin İstanbul İzmir Kars Kastamonu Kayseri Kırklareli Kırşehir Kocaeli Konya Kütahya Malatya Manisa Kahramanmaraş Mardin Muğla Muş Nevşehir Niğde Ordu Rize Sakarya Samsun Siirt Sinop Sivas Tekirdağ Tokat Trabzon Tunceli Şanlıurfa Uşak Van Yozgat Zonguldak Aksaray Bayburt Karaman Kırıkkale Batman Şırnak Bartın Ardahan Iğdır Yalova Karabük Kilis Osmaniye Düzce'.split()
def lower(v):return v.replace('I','ı').replace('İ','i').lower()
def title(v):return lower(v).title()
def integer(v):
 t=str(v).strip()
 return int(float(t)) if re.fullmatch(r'\d+(\.0)?',t) else None
def location(header):
 parts=re.findall(r'\(([^)]+)\)',header)
 for part in parts:
  for city in CITIES:
   if lower(part)==lower(city):return city
 for city in sorted(CITIES,key=len,reverse=True):
  if lower(header).startswith(lower(city)+' '):return city
 if header.startswith('GEBZE '):return 'Kocaeli'
 if parts and 'Üniversitesi' not in parts[0]:return title(parts[0])
 return 'Belirtilmedi'
LANGUAGES={'İngilizce','Almanca','Arapça','Fransızca','Rusça','İspanyolca','Bulgarca','Ermenice','İtalyanca','Boşnakça','Çince','Korece','Türkçe-Rusça','Türkçe'}
old=json.loads(Path('data/osym-2026-selected.json').read_text(encoding='utf-8'))
pilot=json.loads(Path('data/pilot-isubu-2026-10.json').read_text(encoding='utf-8'))
oldbycode={p['officialCode']:p for p in old['programs']}
programs=[];sources=list(pilot['sources']);report={'tables':{},'unknownLocation':[]};codes=set()
for table,inputfile,url in [(3,sys.argv[1],'https://dokuman.osym.gov.tr/web/2026/7/tablo-3-29u1s7pl.xls'),(4,sys.argv[2],'https://dokuman.osym.gov.tr/web/2026/7/tablo-4-hohu0j-30164357.xls')]:
 path=Path(inputfile);sheet=xlrd.open_workbook(path).sheet_by_index(0)
 rankcol=9 if table==3 else 10;conditioncol=8 if table==3 else 9
 assert '2025-YKS' in str(sheet.cell_value(0,rankcol)) and 'BAŞARI' in str(sheet.cell_value(1,rankcol))
 key=f'osym-2026-tablo{table}-full-20261015'
 sources.append({'key':key,'title':f'ÖSYM 2026 YKS Tablo-{table} — '+('önlisans' if table==3 else 'lisans'),'url':url,'publisher':'ÖSYM','retrievedAt':'2026-10-15','notes':f'2026 genel ve özel kontenjanlar; 2025 başarı sırası ve taban puan ayrı yıl. Kaynak SHA-256: {hashlib.sha256(path.read_bytes()).hexdigest()}. Tüm sütunlar ham ayrıntı kaydında korunur.'})
 headers=[' / '.join(str(sheet.cell_value(i,c)).strip() for i in range(3) if str(sheet.cell_value(i,c)).strip()) for c in range(sheet.ncols)]
 current=None;faculty='';nsource=0;added=0;unclassified=[]
 for index in range(3,sheet.nrows):
  row=sheet.row_values(index);raw=str(row[1]).strip();code=str(row[0]).strip()
  if not code and raw:
   national='(Devlet Üniversitesi)' in raw or '(Vakıf Üniversitesi)' in raw
   foreign=('ÜNİVERSİTESİ (' in raw or 'UNIVERSITY (' in raw) and not ('FAKÜLTESİ' in raw or 'YÜKSEKOKULU' in raw)
   if national or foreign:
    name=re.sub(r'\s*\((?:Devlet Üniversitesi|Vakıf Üniversitesi)\)\s*$','',raw).strip()
    city=location(name)
    name=re.sub(r'\s*\('+re.escape(city.upper().replace('I','I'))+r'\)\s*$','',name) if city in CITIES else name
    # Remove a parenthesized domestic city without removing foreign/campus identity.
    name=re.sub(r'\s*\(([^)]+)\)\s*$',lambda m:'' if any(lower(m[1])==lower(c) for c in CITIES) else m[0],name).strip()
    current=(title(name),city,'Devlet' if '(Devlet Üniversitesi)' in raw else 'Vakıf' if '(Vakıf Üniversitesi)' in raw else 'Yurt dışı');faculty=''
    if city=='Belirtilmedi':report['unknownLocation'].append(raw)
   else:faculty=raw
   continue
  if not re.fullmatch(r'\d{9}',code):continue
  nsource+=1
  if not current:unclassified.append(index+1);continue
  if code in codes:raise ValueError('Duplicate source code '+code)
  codes.add(code)
  university,city,kind=current
  if str(row[3]) not in ['SAY','EA','SÖZ','DİL','TYT']:raise ValueError('Unknown score '+str(row[3]))
  language=next((t for t in re.findall(r'\(([^)]+)\)',raw) if t in LANGUAGES),'Türkçe')
  scholarship='Burs oranı / ücret doğrulanmadı';percent=None
  if '(Burslu)' in raw:scholarship='Burslu';percent=100
  elif re.search(r'\(%\s*(\d+) İndirimli\)',raw):
   percent=int(re.search(r'\(%\s*(\d+) İndirimli\)',raw)[1]);scholarship=f'%{percent} İndirimli'
  elif '(Ücretli)' in raw:scholarship='Ücretli';percent=0
  name=raw
  for token in [language,'Burslu','Ücretli']:
   name=name.replace(' ('+token+')','')
  name=re.sub(r'\s*\(%\s*\d+ İndirimli\)','',name).strip()
  p={'key':'osym-'+code,'officialCode':code,'university':university,'city':city,'universityType':kind,'name':name,'language':language,'scoreType':str(row[3]),'scholarship':scholarship,'scholarshipPercent':percent,
   'description':f'{university}, {title(faculty)}: {raw}. ÖSYM 2026 Tablo-{table}, Excel satırı {index+1}. Süre: {integer(row[2])} yıl. Özel koşul numaraları: {str(row[conditioncol]).strip() or "yok"}. Kılavuz koşullarını inceleyin. Ayrıntılı ders içeriği henüz eklenmedi.',
   'subjects':[],'sources':[key],'years':[{'year':2025,'rank':integer(row[rankcol]),'quota':None,'tuition':None,'currency':None,'sourceKey':key},{'year':2026,'rank':None,'quota':integer(row[4]),'tuition':None,'currency':None,'sourceKey':key}],
   'admissionData':{'year':2026,'table':str(table),'row':index+1,'sourceKey':key,'columns':dict(zip(headers,row))},'_faculty':faculty}
  # Preserve existing canonical identity / hand-curated ISUBÜ material.
  if code in oldbycode:
   prev=oldbycode[code]
   p.update({k:prev[k] for k in ['key','university']})
   if code in ['112572418','112500122']:
    p.update({k:prev[k] for k in ['name','description','subjects','scholarship','scholarshipPercent']})
    p['sources']+= [s for s in prev['sources'] if not s.startswith('osym-')]
    if code=='112572418':p['years']=[y for y in prev['years'] if y['year']<2026]+[p['years'][1]]
  programs.append(p);added+=1
 report['tables'][str(table)]={'sourceRows':nsource,'imported':added,'unclassifiedRows':unclassified}
 if unclassified:raise ValueError(f'Table {table} unclassified rows: {unclassified}')
groups=collections.Counter((p['university'],p['name'],p['language'],p['scholarship']) for p in programs)
for p in programs:
 if groups[(p['university'],p['name'],p['language'],p['scholarship'])]>1:p['name']+=f" — {title(p['_faculty'])} [{p['officialCode']}]"
 p.pop('_faculty')
manifest={'version':'osym-2026-tables3-4-full-v1','notes':'ÖSYM 2026 Tablo-3 ve Tablo-4 program kodlu tüm satırlar. TYT önlisans ve lisans; KKTC/yurt dışı ayrı türdür. 2025 sıra ile 2026 genel kontenjan ayrı yıllarda tutulur. Ham sütunlar ayrıntı kaydında korunur; ücretler ve ders içerikleri eksiktir. Açık/uzaktan/ortak/özel uyruk seçeneklerinin koşulları kılavuzdan incelenmelidir.','sources':sources,'programs':programs}
Path(sys.argv[3]).write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
report.update({'records':len(programs),'institutions':len(set(p['university'] for p in programs)),'languages':dict(collections.Counter(p['language'] for p in programs)),'scores':dict(collections.Counter(p['scoreType'] for p in programs)),'types':dict(collections.Counter(p['universityType'] for p in programs))})
Path(sys.argv[3]+'.report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,ensure_ascii=False))
