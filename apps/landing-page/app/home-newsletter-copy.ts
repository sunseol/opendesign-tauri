import type { LandingLocaleCode } from './i18n';

export type HomeNewsletterCopy = {
  readonly title: string;
  readonly description: string;
  readonly button: string;
  readonly done: string;
  readonly error: string;
  readonly placeholder: string;
};

const HOME_NEWSLETTER_COPY = {
  en: {
    title: 'The Open Design newsletter',
    description:
      'New templates, design-system updates, ambassador events, and product news — straight to your inbox.',
    button: 'Subscribe',
    done: "Thanks — you're on the list!",
    error: "Couldn't subscribe just now — please try again.",
    placeholder: 'you@studio.com',
  },
  zh: {
    title: 'Open Design 订阅',
    description: '新模板、设计系统更新、大使活动与产品动态，直接发到你的邮箱。',
    button: '订阅',
    done: '已收到，感谢关注！',
    error: '订阅失败，请稍后重试。',
    placeholder: 'you@studio.com',
  },
  'zh-tw': {
    title: 'Open Design 訂閱',
    description: '新範本、設計系統更新、大使活動與產品動態，直接寄到你的信箱。',
    button: '訂閱',
    done: '已收到，感謝關注！',
    error: '訂閱失敗，請稍後再試。',
    placeholder: 'you@studio.com',
  },
  ja: {
    title: 'Open Design ニュースレター',
    description:
      '新しいテンプレート、デザインシステムの更新、アンバサダーイベント、プロダクトニュースを受信箱へ届けます。',
    button: '登録',
    done: '登録しました。ありがとうございます。',
    error: '今は登録できません。もう一度お試しください。',
    placeholder: 'you@studio.com',
  },
  ko: {
    title: 'Open Design 뉴스레터',
    description: '새 템플릿, 디자인 시스템 업데이트, 앰배서더 이벤트와 제품 소식을 이메일로 받아보세요.',
    button: '구독',
    done: '구독 신청이 완료되었습니다.',
    error: '지금은 구독할 수 없습니다. 다시 시도해 주세요.',
    placeholder: 'you@studio.com',
  },
  de: {
    title: 'Der Open Design Newsletter',
    description: 'Neue Templates, Design-System-Updates, Ambassador-Events und Produktnews direkt in dein Postfach.',
    button: 'Abonnieren',
    done: 'Danke, du bist auf der Liste.',
    error: 'Abo gerade nicht möglich. Bitte versuche es erneut.',
    placeholder: 'you@studio.com',
  },
  fr: {
    title: 'La newsletter Open Design',
    description: 'Nouveaux modèles, mises à jour de systèmes, événements ambassadeurs et nouvelles produit dans votre boîte.',
    button: "S'abonner",
    done: 'Merci, vous êtes sur la liste.',
    error: "Impossible de s'abonner pour le moment. Réessayez.",
    placeholder: 'you@studio.com',
  },
  ru: {
    title: 'Рассылка Open Design',
    description: 'Новые шаблоны, обновления дизайн-систем, события амбассадоров и новости продукта прямо в почте.',
    button: 'Подписаться',
    done: 'Спасибо, вы в списке.',
    error: 'Сейчас не удалось подписаться. Попробуйте еще раз.',
    placeholder: 'you@studio.com',
  },
  es: {
    title: 'Newsletter de Open Design',
    description: 'Nuevas plantillas, actualizaciones de sistemas, eventos de embajadores y novedades del producto en tu correo.',
    button: 'Suscribirme',
    done: 'Gracias, ya estás en la lista.',
    error: 'No se pudo suscribir ahora. Inténtalo de nuevo.',
    placeholder: 'you@studio.com',
  },
  'pt-br': {
    title: 'Newsletter do Open Design',
    description: 'Novos templates, atualizações de design systems, eventos de embaixadores e novidades do produto no seu email.',
    button: 'Assinar',
    done: 'Obrigado, você entrou na lista.',
    error: 'Não foi possível assinar agora. Tente novamente.',
    placeholder: 'you@studio.com',
  },
  it: {
    title: 'Newsletter di Open Design',
    description: 'Nuovi template, aggiornamenti ai design system, eventi ambassador e notizie prodotto nella tua inbox.',
    button: 'Iscriviti',
    done: 'Grazie, sei in lista.',
    error: 'Impossibile iscriversi ora. Riprova.',
    placeholder: 'you@studio.com',
  },
  vi: {
    title: 'Bản tin Open Design',
    description: 'Template mới, cập nhật design system, sự kiện ambassador và tin sản phẩm gửi thẳng vào hộp thư.',
    button: 'Đăng ký',
    done: 'Cảm ơn, bạn đã vào danh sách.',
    error: 'Chưa thể đăng ký lúc này. Vui lòng thử lại.',
    placeholder: 'you@studio.com',
  },
  pl: {
    title: 'Newsletter Open Design',
    description: 'Nowe szablony, aktualizacje design systemów, wydarzenia ambasadorów i wieści produktowe prosto na mail.',
    button: 'Subskrybuj',
    done: 'Dzięki, jesteś na liście.',
    error: 'Nie udało się zapisać. Spróbuj ponownie.',
    placeholder: 'you@studio.com',
  },
  id: {
    title: 'Newsletter Open Design',
    description: 'Template baru, pembaruan design system, acara ambassador, dan kabar produk langsung ke inbox.',
    button: 'Berlangganan',
    done: 'Terima kasih, Anda sudah masuk daftar.',
    error: 'Belum bisa berlangganan sekarang. Coba lagi.',
    placeholder: 'you@studio.com',
  },
  nl: {
    title: 'De Open Design nieuwsbrief',
    description: 'Nieuwe templates, design-system updates, ambassador-events en productnieuws rechtstreeks in je inbox.',
    button: 'Abonneren',
    done: 'Dank je, je staat op de lijst.',
    error: 'Aanmelden lukt nu niet. Probeer het opnieuw.',
    placeholder: 'you@studio.com',
  },
  ar: {
    title: 'نشرة Open Design',
    description: 'قوالب جديدة وتحديثات أنظمة التصميم وفعاليات السفراء وأخبار المنتج مباشرة إلى بريدك.',
    button: 'اشترك',
    done: 'شكراً، تمت إضافتك إلى القائمة.',
    error: 'تعذر الاشتراك الآن. حاول مرة أخرى.',
    placeholder: 'you@studio.com',
  },
  tr: {
    title: 'Open Design bülteni',
    description: 'Yeni şablonlar, design system güncellemeleri, elçi etkinlikleri ve ürün haberleri gelen kutuna gelsin.',
    button: 'Abone ol',
    done: 'Teşekkürler, listeye eklendin.',
    error: 'Şu anda abone olunamadı. Tekrar dene.',
    placeholder: 'you@studio.com',
  },
  uk: {
    title: 'Розсилка Open Design',
    description: 'Нові шаблони, оновлення дизайн-систем, події амбасадорів і новини продукту прямо на пошту.',
    button: 'Підписатися',
    done: 'Дякуємо, ви у списку.',
    error: 'Зараз не вдалося підписатися. Спробуйте ще раз.',
    placeholder: 'you@studio.com',
  },
} satisfies Record<LandingLocaleCode, HomeNewsletterCopy>;

export function getHomeNewsletterCopy(locale: LandingLocaleCode): HomeNewsletterCopy {
  return HOME_NEWSLETTER_COPY[locale];
}
