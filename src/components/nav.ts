import { BarChart3, Calendar, Film, Home, PenLine, Plug, Settings, Workflow } from 'lucide-react';

export const NAV = [
  { to: '/', name: 'Boshqaruv', sub: 'Bugungi holat, keyingi video va natijalar', icon: Home },
  { to: '/videolar', name: 'Videolar', sub: 'Har bir video qayerda, qachon joylandi va qanday natija berdi', icon: Film },
  { to: '/reja', name: 'Reja va kalendar', sub: 'Qachon nima chiqadi va tayyormi', icon: Calendar },
  { to: '/ssenariylar', name: 'Ssenariylar', sub: 'G‘oyadan joylashgacha ishlab chiqarish liniyasi', icon: PenLine },
  { to: '/tahlil', name: 'Tahlil', sub: 'Nima ishlayapti, qachon joylash kerak', icon: BarChart3 },
  { to: '/platformalar', name: 'Platformalar', sub: 'Ulangan akkauntlar va obunachilar', icon: Plug },
  { to: '/konveyer', name: 'Konveyer va API', sub: 'Avtomatik joylash navbati va integratsiyalar', icon: Workflow },
  { to: '/sozlamalar', name: 'Sozlamalar', sub: 'Maqsadlar, ma’lumotlar va ko‘rinish', icon: Settings },
] as const;
