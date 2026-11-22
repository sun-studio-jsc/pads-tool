// Generated from mockups/devices.json: Android phones and tablets with a downloaded frame.
// Excludes Apple, computers, watches, and devices without a single screen opening.
// screen = transparent opening in the mockup PNG (pixels), where the playable sits.

export type DeviceMockup = {
  src: string;
  imageWidth: number;
  imageHeight: number;
  screen: { x: number; y: number; width: number; height: number; radius: number };
};

export type AndroidDevice = {
  name: string;
  width: number;
  height: number;
  type: 'phone' | 'tablet';
  mockup: DeviceMockup;
};

export const ANDROID_DEVICES: AndroidDevice[] = [
  { name: "Google Pixel 10", width: 412, height: 924, type: 'phone', mockup: { src: '/mockups/android/google-pixel-10-2026.png', imageWidth: 379, imageHeight: 800, screen: { x: 18, y: 19, width: 340, height: 763, radius: 50 } } },
  { name: "Google Pixel 10 PRO", width: 410, height: 912, type: 'phone', mockup: { src: '/mockups/android/google-pixel-10-pro-2026.png', imageWidth: 380, imageHeight: 800, screen: { x: 15, y: 14, width: 346, height: 771, radius: 48 } } },
  { name: "Pixel 10 PRO Fold folded", width: 412, height: 901, type: 'phone', mockup: { src: '/mockups/android/google-pixel-10-pro-fold-2026.png', imageWidth: 395, imageHeight: 800, screen: { x: 26, y: 21, width: 346, height: 758, radius: 48 } } },
  { name: "Google Pixel 11 PRO", width: 410, height: 914, type: 'phone', mockup: { src: '/mockups/android/google-pixel-11-pro-2026.png', imageWidth: 379, imageHeight: 800, screen: { x: 16, y: 16, width: 345, height: 768, radius: 50 } } },
  { name: "Google Pixel 11 Pro XL", width: 448, height: 997, type: 'phone', mockup: { src: '/mockups/android/google-pixel-11-pro-xl-2026.png', imageWidth: 377, imageHeight: 800, screen: { x: 15, y: 15, width: 344, height: 766, radius: 44 } } },
  { name: "Google Pixel 5", width: 393, height: 851, type: 'phone', mockup: { src: '/mockups/android/google-pixel-5.png', imageWidth: 392, imageHeight: 800, screen: { x: 19, y: 19, width: 352, height: 762, radius: 31 } } },
  { name: "Google Pixel 6 PRO", width: 360, height: 780, type: 'phone', mockup: { src: '/mockups/android/google-pixel-6-pro.png', imageWidth: 368, imageHeight: 800, screen: { x: 10, y: 17, width: 347, height: 754, radius: 14 } } },
  { name: "Google Pixel 8 (2023)", width: 412, height: 915, type: 'phone', mockup: { src: '/mockups/android/google-pixel-8-2024.png', imageWidth: 380, imageHeight: 800, screen: { x: 17, y: 17, width: 343, height: 763, radius: 31 } } },
  { name: "Huawei P30 PRO", width: 360, height: 780, type: 'phone', mockup: { src: '/mockups/android/huawei-p30-pro.png', imageWidth: 371, imageHeight: 800, screen: { x: 8, y: 14, width: 352, height: 763, radius: 24 } } },
  { name: "Infinix Hot 70", width: 360, height: 788, type: 'phone', mockup: { src: '/mockups/android/infinix-hot-70-2026.png', imageWidth: 379, imageHeight: 800, screen: { x: 17, y: 21, width: 343, height: 750, radius: 41 } } },
  { name: "Motorola Moto G87", width: 424, height: 924, type: 'phone', mockup: { src: '/mockups/android/motorola-moto-g87-2026.png', imageWidth: 381, imageHeight: 800, screen: { x: 12, y: 15, width: 354, height: 772, radius: 52 } } },
  { name: "Motorola Razr 70 Ultra", width: 412, height: 1008, type: 'phone', mockup: { src: '/mockups/android/motorola-razr-70-ultra-2026.png', imageWidth: 352, imageHeight: 800, screen: { x: 21, y: 21, width: 310, height: 757, radius: 27 } } },
  { name: "Generic device on Android", width: 360, height: 800, type: 'phone', mockup: { src: '/mockups/android/non-branded-android-smartphone.png', imageWidth: 380, imageHeight: 800, screen: { x: 17, y: 17, width: 344, height: 766, radius: 27 } } },
  { name: "OnePlus Nord 2", width: 412, height: 915, type: 'phone', mockup: { src: '/mockups/android/oneplus-nord-2.png', imageWidth: 369, imageHeight: 800, screen: { x: 16, y: 17, width: 339, height: 753, radius: 34 } } },
  { name: "OPPO Find X3 PRO", width: 360, height: 804, type: 'phone', mockup: { src: '/mockups/android/oppo-find-x3-pro.png', imageWidth: 360, imageHeight: 800, screen: { x: 10, y: 19, width: 340, height: 761, radius: 31 } } },
  { name: "Samsung Galaxy A12", width: 360, height: 800, type: 'phone', mockup: { src: '/mockups/android/samsung-galaxy-a12-2021.png', imageWidth: 370, imageHeight: 800, screen: { x: 16, y: 19, width: 335, height: 745, radius: 31 } } },
  { name: "Samsung Galaxy A17", width: 412, height: 892, type: 'phone', mockup: { src: '/mockups/android/samsung-galaxy-a17-2025.png', imageWidth: 384, imageHeight: 800, screen: { x: 18, y: 18, width: 344, height: 747, radius: 34 } } },
  { name: "Samsung Galaxy Fold (2019)", width: 768, height: 1076, type: 'phone', mockup: { src: '/mockups/android/samsung-galaxy-fold.png', imageWidth: 645, imageHeight: 800, screen: { x: 12, y: 14, width: 619, height: 773, radius: 17 } } },
  { name: "Samsung Galaxy Z Fold 2 unfolded (2020)", width: 884, height: 1104, type: 'phone', mockup: { src: '/mockups/android/samsung-galaxy-fold2.png', imageWidth: 645, imageHeight: 800, screen: { x: 12, y: 14, width: 619, height: 773, radius: 17 } } },
  { name: "Samsung Galaxy Note20 Ultra", width: 412, height: 883, type: 'phone', mockup: { src: '/mockups/android/samsung-galaxy-note20-ultra.png', imageWidth: 371, imageHeight: 800, screen: { x: 4, y: 10, width: 361, height: 773, radius: 10 } } },
  { name: "Samsung Galaxy S20", width: 360, height: 800, type: 'phone', mockup: { src: '/mockups/android/samsung-galaxy-s20.png', imageWidth: 368, imageHeight: 800, screen: { x: 16, y: 15, width: 334, height: 766, radius: 27 } } },
  { name: "Samsung Galaxy S21 Ultra", width: 360, height: 800, type: 'phone', mockup: { src: '/mockups/android/samsung-galaxy-s21-ultra.png', imageWidth: 369, imageHeight: 800, screen: { x: 10, y: 12, width: 347, height: 772, radius: 27 } } },
  { name: "Samsung Galaxy S22 (2022)", width: 360, height: 780, type: 'phone', mockup: { src: '/mockups/android/samsung-galaxy-s22-2022.png', imageWidth: 388, imageHeight: 800, screen: { x: 15, y: 15, width: 355, height: 769, radius: 34 } } },
  { name: "Samsung Galaxy S22+ (2022)", width: 360, height: 780, type: 'phone', mockup: { src: '/mockups/android/samsung-galaxy-s22-plus-2022.png', imageWidth: 388, imageHeight: 800, screen: { x: 15, y: 15, width: 355, height: 769, radius: 34 } } },
  { name: "Samsung Galaxy S22 ULTRA (2022)", width: 360, height: 772, type: 'phone', mockup: { src: '/mockups/android/samsung-galaxy-s22-ultra-2022.png', imageWidth: 379, imageHeight: 800, screen: { x: 4, y: 5, width: 368, height: 788, radius: 7 } } },
  { name: "Samsung Galaxy S24 (2024)", width: 360, height: 780, type: 'phone', mockup: { src: '/mockups/android/samsung-galaxy-s24-2024.png', imageWidth: 386, imageHeight: 800, screen: { x: 14, y: 14, width: 356, height: 773, radius: 34 } } },
  { name: "Samsung Galaxy S24 Ultra (2024)", width: 384, height: 832, type: 'phone', mockup: { src: '/mockups/android/samsung-galaxy-s24-ultra-2024.png', imageWidth: 391, imageHeight: 800, screen: { x: 17, y: 14, width: 355, height: 770, radius: 3 } } },
  { name: "Galaxy S26 ULTRA", width: 412, height: 891, type: 'phone', mockup: { src: '/mockups/android/samsung-galaxy-s26-ultra-2026.png', imageWidth: 385, imageHeight: 800, screen: { x: 11, y: 10, width: 360, height: 779, radius: 0 } } },
  { name: "Samsung Galaxy Tab S7", width: 800, height: 1280, type: 'tablet', mockup: { src: '/mockups/android/samsung-galaxy-tab-s7.png', imageWidth: 522, imageHeight: 800, screen: { x: 27, y: 27, width: 466, height: 746, radius: 7 } } },
  { name: "Samsung Galaxy Z Flip3 (2021)", width: 360, height: 880, type: 'phone', mockup: { src: '/mockups/android/samsung-galaxy-z-flip3-2021.png', imageWidth: 356, imageHeight: 800, screen: { x: 21, y: 21, width: 310, height: 757, radius: 20 } } },
  { name: "Samsung Galaxy Z Fold8 folded", width: 416, height: 657, type: 'phone', mockup: { src: '/mockups/android/samsung-galaxy-z-fold8-folded-2026.png', imageWidth: 532, imageHeight: 800, screen: { x: 29, y: 22, width: 479, height: 756, radius: 10 } } },
  { name: "Samsung Galaxy Z Fold8 unfolded", width: 816, height: 616, type: 'phone', mockup: { src: '/mockups/android/samsung-galaxy-z-fold8-unfolded-2026.png', imageWidth: 800, imageHeight: 612, screen: { x: 17, y: 17, width: 763, height: 576, radius: 7 } } },
  { name: "Xiaomi 12", width: 360, height: 800, type: 'phone', mockup: { src: '/mockups/android/xiaomi-12-2022.png', imageWidth: 369, imageHeight: 800, screen: { x: 11, y: 14, width: 344, height: 767, radius: 41 } } },
  { name: "Xiaomi 17", width: 406, height: 885, type: 'phone', mockup: { src: '/mockups/android/xiaomi-17-2026.png', imageWidth: 385, imageHeight: 800, screen: { x: 12, y: 11, width: 357, height: 778, radius: 51 } } },
  { name: "Xiaomi 17 Ultra", width: 400, height: 869, type: 'phone', mockup: { src: '/mockups/android/xiaomi-17-ultra-2026.png', imageWidth: 384, imageHeight: 800, screen: { x: 12, y: 12, width: 358, height: 777, radius: 50 } } },
  { name: "Xiaomi 17T", width: 423, height: 919, type: 'phone', mockup: { src: '/mockups/android/xiaomi-17t-2026.png', imageWidth: 383, imageHeight: 800, screen: { x: 13, y: 13, width: 356, height: 774, radius: 52 } } },
  { name: "Xiaomi 17T Pro", width: 427, height: 924, type: 'phone', mockup: { src: '/mockups/android/xiaomi-17t-pro-2026.png', imageWidth: 383, imageHeight: 800, screen: { x: 11, y: 11, width: 359, height: 778, radius: 44 } } },
  { name: "Xiaomi Mi 11i", width: 360, height: 800, type: 'phone', mockup: { src: '/mockups/android/xiaomi-mi-11i.png', imageWidth: 376, imageHeight: 800, screen: { x: 15, y: 16, width: 342, height: 760, radius: 34 } } },
  { name: "Xiaomi Redmi Note 17", width: 393, height: 871, type: 'phone', mockup: { src: '/mockups/android/xiaomi-redmi-note-17-2026.png', imageWidth: 376, imageHeight: 800, screen: { x: 15, y: 14, width: 344, height: 763, radius: 0 } } },
  { name: "Zebra TC78", width: 412, height: 818, type: 'phone', mockup: { src: '/mockups/android/zebra-tc78.png', imageWidth: 386, imageHeight: 800, screen: { x: 37, y: 97, width: 312, height: 620, radius: 3 } } },
];
