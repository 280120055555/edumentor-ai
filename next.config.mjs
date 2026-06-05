import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
    dest: "public",
    cacheOnFrontEndNav: true,
    aggressiveFrontEndNavCaching: true,
    reloadOnOnline: true,
    swMinify: true,
    disable: process.env.NODE_ENV === "development",
    workboxOptions: {
        expiration: {
            maxEntries: 64,
            maxAgeSeconds: 30 * 24 * 60 * 60, // 1 месяц кэша
        },
    },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
        // Сохраняем твою настройку игнорирования ошибок
        ignoreBuildErrors: true,
    },
    images: {
        // Сохраняем твою настройку картинок
        unoptimized: true,
    },
};

export default withPWA(nextConfig);