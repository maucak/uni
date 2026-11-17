// The institution ID is the source scope stored in PostgreSQL and Qdrant.
export const institutions = [
  {id:'isubu',name:'Isparta Uygulamalı Bilimler Üniversitesi',shortName:'İSUBÜ',city:'Isparta',aliases:['isubu','isparta uygulamali bilimler universitesi']},
  {id:'sdu',name:'Süleyman Demirel Üniversitesi',shortName:'SDÜ',city:'Isparta',aliases:['sdu','suleyman demirel universitesi']},
  {id:'pau',name:'Pamukkale Üniversitesi',shortName:'PAÜ',city:'Denizli',aliases:['pau','pamukkale universitesi']},
  {id:'akdeniz',name:'Akdeniz Üniversitesi',shortName:'Akdeniz Üniversitesi',city:'Antalya',aliases:['akdeniz universitesi','akdeniz universite']},
] as const;
export type InstitutionId = typeof institutions[number]['id'];
export function foldInstitution(value:string) {
  return value.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/\s+/g,' ').trim();
}
export function findInstitution(value:string) {
  const normalized=foldInstitution(value);
  return institutions.find(i=>i.aliases.some(a=>normalized===a));
}
// An alias must be a complete token; "pau" must not match a longer word.
export function institutionsInText(value:string) {
  const normalized=foldInstitution(value);
  return institutions.filter(i=>i.aliases.some(alias=>new RegExp(`(?:^|[^a-z])${alias}(?:$|[^a-z])`).test(normalized)));
}
