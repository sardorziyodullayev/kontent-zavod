import { BarChart3, Calendar, Film, Home, PenLine, Plug, Settings, Workflow } from 'lucide-react';

export const NAV = [
  { to: '/', name: 'Boshqaruv', sub: 'Zavod hozir nima qilyapti, keyingi video va natijalar', icon: Home, group: 'Zavod' },
  { to: '/reja', name: 'Reja va kalendar', sub: 'Qachon nima chiqadi va tayyormi', icon: Calendar, group: 'Zavod' },
  { to: '/ssenariylar', name: 'Ssenariylar', sub: 'G‘oyadan joylashgacha ishlab chiqarish liniyasi', icon: PenLine, group: 'Zavod' },
  { to: '/videolar', name: 'Videolar', sub: 'Har bir video qayerda, qachon joylandi va qanday natija berdi', icon: Film, group: 'Zavod' },
  { to: '/tahlil', name: 'Tahlil', sub: 'Nima ishlayapti, qachon joylash kerak', icon: BarChart3, group: 'Natija' },
  { to: '/platformalar', name: 'Platformalar', sub: 'Ulangan akkauntlar va obunachilar', icon: Plug, group: 'Natija' },
  { to: '/konveyer', name: 'Konveyer va API', sub: 'Avtomatik joylash navbati va integratsiyalar', icon: Workflow, group: 'Tizim' },
  { to: '/sozlamalar', name: 'Sozlamalar', sub: 'Maqsadlar, ma’lumotlar va ko‘rinish', icon: Settings, group: 'Tizim' },
] as const;
