import type { BrandProfile } from "../src/presentation/brand-profile.js";

/**
 * First DEMO brand configuration.
 * Brand narrative and visual tokens stay outside certificate business rules.
 */
export const VASTU_BRAND_PROFILE: BrandProfile = {
  displayName: "PelzDesign | пространство по васту",
  tagline: "Подарок, который помогает по-новому почувствовать свой дом.",
  contactUrl: "https://vk.me/pelts_tatyana_vastu",
  contactLabel: "Связаться со специалистом",
  giftStory: {
    openingEyebrow: "Особенный подарок для вас",
    openingTitle: "Дом, который поддерживает",
    openingText: "Иногда самый ценный подарок — возможность по-новому взглянуть на пространство, в котором проходит наша жизнь.",
    openingAction: "Открыть подарок",
    storyEyebrow: "О вашем доме",
    storyTitle: "Место, где начинается ваша жизнь",
    storyText: "Дом — это гораздо больше, чем стены и мебель. Здесь мы отдыхаем, набираемся сил, строим планы, встречаем близких и проживаем важные моменты. Поэтому так хочется, чтобы пространство было в гармонии с теми, кто в нём живёт. У каждого дома свой характер и свои особенности — и иногда стоит посмотреть на него немного иначе.",
    personalMessageTitle: "Несколько слов от того, кто дарит",
    serviceEyebrow: "Ваш подарок",
    serviceTitle: "Персональный Васту-разбор дома",
    serviceText: "Это возможность внимательнее познакомиться со своим пространством через принципы Васту и получить индивидуальные ориентиры для дальнейшей работы с ним.",
    inclusions: [
      {
        title: "Персональная Васту-карта",
        description: "Индивидуальная карта вашего пространства в PDF.",
      },
      {
        title: "Голосовой разбор",
        description: "Аудиообъяснение с разбором особенностей вашей планировки.",
      },
      {
        title: "Практические рекомендации",
        description: "Идеи и рекомендации, которые помогут применить полученные знания.",
      },
    ],
    closingEyebrow: "С чего начинается гармония",
    closingTitle: "Пусть дома вам будет хорошо",
    closingText: "Пусть ваш дом станет местом, где спокойно, тепло и легко быть собой. Чтобы начать, свяжитесь со специалистом — вместе вы обсудите дальнейшие шаги.",
    activationActionLabel: "Активировать подарок",
  },
  theme: {
    page: "#f3f0e8",
    surface: "#fffdf8",
    ink: "#303329",
    muted: "#77796e",
    line: "#e4dfd2",
    accent: "#68765d",
    accentInk: "#ffffff",
  },
};

/** Sample personalization shown only in the isolated DEMO buyer journey. */
export const VASTU_DEMO_PERSONALIZATION = {
  recipientName: "Илья и Анна",
  greetingText: "Дорогие Илья и Анна! Пусть ваш дом будет местом, где спокойно, тепло и легко быть собой.",
  senderSignature: "С теплом, ваши друзья",
} as const;

export const VASTU_DEMO_CATALOG_ITEM = {
  serviceId: "vastu-express-space-review",
  serviceSlug: "express-space-review",
  serviceTitle: "Экспресс-разбор пространства по Васту",
  serviceDescription:
    "Персональный разбор пространства с картой Васту, аудиообъяснением и практическими рекомендациями.",
  variantId: "vastu-express-space-review-standard",
  variantTitle: "Персональный экспресс-разбор",
  variantDescription:
    "В подарок входят персональная карта Васту в PDF, аудиоразбор и практические рекомендации по вашему пространству.",
  amountMinor: 490000,
  currency: "RUB",
  activationUrl: "https://vk.me/pelts_tatyana_vastu",
} as const;
