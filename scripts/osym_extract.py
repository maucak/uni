"""ÖSYM 2026 Tablo-4 -> KampüsPusula manifest. Requires xlrd==2.0.2.
Usage: python scripts/osym_extract.py INPUT.xls OUTPUT.json
Source file stays unchanged; generated data includes source hash and row provenance.
"""
import sys,json,re,hashlib,collections
from pathlib import Path
import xlrd
URL='https://dokuman.osym.gov.tr/web/2026/7/tablo-4-hohu0j-30164357.xls'
SELECTED={
 'ABDULLAH GÜL ÜNİVERSİTESİ':'Kayseri','AKDENİZ ÜNİVERSİTESİ':'Antalya',
 'BOĞAZİÇİ ÜNİVERSİTESİ':'İstanbul','EGE ÜNİVERSİTESİ':'İzmir',
 'HACETTEPE ÜNİVERSİTESİ':'Ankara','KARADENİZ TEKNİK ÜNİVERSİTESİ':'Trabzon',
 'ISPARTA UYGULAMALI BİLİMLER ÜNİVERSİTESİ':'Isparta','SÜLEYMAN DEMİREL ÜNİVERSİTESİ':'Isparta',
 'BAHÇEŞEHİR ÜNİVERSİTESİ':'İstanbul','İHSAN DOĞRAMACI BİLKENT ÜNİVERSİTESİ':'Ankara',
}
def title(value):
 return value.replace('I','ı').replace('İ','i').lower().title()
def integer(value):
 t=str(value).strip()
 if re.fullmatch(r'\d+(\.0)?',t):return int(float(t))
 return None
source=Path(sys.argv[1]);sheet=xlrd.open_workbook(source).sheet_by_index(0)
assert '2025-YKS' in str(sheet.cell_value(0,10)) and 'BAŞARI' in str(sheet.cell_value(1,10))
pilot=json.loads(Path('data/pilot-isubu-2026-10.json').read_text(encoding='utf-8'))
sourcekey='osym-2026-tablo4-20261015'
programs=[];excluded=collections.Counter();university=None;city=None;faculty='';kind=None
for index in range(3,sheet.nrows):
 row=sheet.row_values(index);raw=str(row[1]).strip();code=str(row[0]).strip()
 if '(Devlet Üniversitesi)' in raw or '(Vakıf Üniversitesi)' in raw:
  university=None
  for name,location in SELECTED.items():
   if raw.startswith(name+' ('):
    university=title(name);city=location;kind='Vakıf' if '(Vakıf Üniversitesi)' in raw else 'Devlet';break
  faculty='';continue
 # All other unnumbered uppercase university headings reset the selected context.
 if not code and ('ÜNİVERSİTESİ' in raw or 'UNIVERSITY' in raw) and not ('FAKÜLTE' in raw or 'YÜKSEKOKUL' in raw):
  university=None;continue
 if not university:continue
 if not code:
  if raw:faculty=raw
  continue
 if not re.fullmatch(r'\d{9}',code):continue
 if row[3] not in ('SAY','EA','SÖZ','DİL'):excluded['unsupported_score']+=1;continue
 if any(x in raw for x in ['UOLP','UOLP-','KKTC','SUNY','Çift Diploma']):excluded['joint_or_foreign']+=1;continue
 if re.search(r'\([^)]*(?:Almanca|Fransızca|Arapça|Rusça|%30|% 30)[^)]*\)',raw):excluded['other_or_mixed_language']+=1;continue
 language='İngilizce' if '(İngilizce)' in raw else 'Türkçe'
 scholarship='Burs oranı / ücret doğrulanmadı';percent=None
 if '(Burslu)' in raw:scholarship='Burslu';percent=100
 elif re.search(r'\(%\s*(\d+) İndirimli\)',raw):
  percent=int(re.search(r'\(%\s*(\d+) İndirimli\)',raw)[1]);scholarship=f'%{percent} İndirimli'
 elif '(Ücretli)' in raw:scholarship='Ücretli';percent=0
 name=re.sub(r'\s*\((?:İngilizce|Burslu|Ücretli|%\s*\d+ İndirimli)\)','',raw).strip()
 rank=integer(row[10]);quota=integer(row[4]);conditions=str(row[9]).strip()
 record={'key':f'osym-{code}','officialCode':code,'university':university,'city':city,'universityType':kind,
 'name':name,'language':language,'scoreType':row[3],'scholarship':scholarship,'scholarshipPercent':percent,
 'description':f'{university}, {title(faculty)} bünyesindeki {raw} programı. ÖSYM 2026 Tablo-4, Excel satırı {index+1}. Öğrenim süresi: {integer(row[2])} yıl. Özel koşul numaraları: {conditions or "yok"}. Koşullar için resmî kılavuzu inceleyin. Ayrıntılı ders içeriği henüz eklenmedi.',
 'subjects':[],'sources':[sourcekey],
 'years':[{'year':2025,'rank':rank,'quota':None,'tuition':None,'currency':None,'sourceKey':sourcekey},
 {'year':2026,'rank':None,'quota':quota,'tuition':None,'currency':None,'sourceKey':sourcekey}]}
 if code in ('112572418','112500122'):
  old=next(p for p in pilot['programs'] if p['key']==('isubu-computer-tr-general' if code=='112572418' else 'isubu-computer-en-general'))
  record.update({k:old[k] for k in ['key','university','name','description','subjects','scholarship','scholarshipPercent']})
  record['sources']+=old['sources']
  if old['years']:record['years']=old['years']+[record['years'][1]]
 record['_faculty']=faculty
 programs.append(record)
# The same name can occur in different faculties: preserve identity rather than merge.
groups=collections.Counter((p['university'],p['name'],p['language'],p['scholarship']) for p in programs)
for p in programs:
 if groups[(p['university'],p['name'],p['language'],p['scholarship'])]>1:p['name']+=f" — {title(p['_faculty'])} [{p['officialCode']}]"
 p.pop('_faculty')
manifest={'version':'osym-2026-selected-v1','notes':'Seçilmiş 10 üniversitenin uygun lisans kayıtları. Türkiye geneli tam katalog değildir. 2026 genel kontenjanı ve 2025 başarı sırası ayrı yıllarda tutulur. Ek kontenjanlar dahil değildir. Dil/burs seçenekleri program koduyla ayrılır. Ayrıntılı ders içerikleri ve ücretler eksiktir.',
'sources':[{'key':sourcekey,'title':'ÖSYM 2026 YKS Tablo-4 — lisans programları','url':URL,'publisher':'ÖSYM','retrievedAt':'2026-10-15',
'notes':f'2026 genel kontenjanı (5. sütun); 2025 başarı sırası (11. sütun). Boş/işaretli sıralama null. Genel kontenjan özel kontenjanları kapsamaz. Dosya SHA-256: {hashlib.sha256(source.read_bytes()).hexdigest()}.'}]+pilot['sources'],'programs':programs}
Path(sys.argv[2]).write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'programs':len(programs),'universities':len(set(p['university'] for p in programs)),'excluded':dict(excluded),'scoreTypes':dict(collections.Counter(p['scoreType'] for p in programs))},ensure_ascii=False))
