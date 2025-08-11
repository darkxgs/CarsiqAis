"use client"

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import dynamic from 'next/dynamic'

// Import the chat component with SSR disabled (we'll use this on a different route)
const ChatPageClient = dynamic(
  () => import('@/components/chat/ChatPage'),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-pulse text-center">
          <div className="text-4xl mb-4">🛢️</div>
          <p className="text-gray-600">جاري تحميل مساعد زيوت السيارات...</p>
        </div>
      </div>
    )
  }
)

export default function LandingPage() {
  const [featuredTab, setFeaturedTab] = useState('jeep')

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="relative w-full py-6 px-4 md:px-8 lg:px-12 header-enhanced">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 header-logo-enhanced">
              <Image 
                src="/logo.png" 
                alt="هندسة السيارات" 
                width={72} 
                height={72} 
                className="relative z-10 rounded-full logo-text-sharp w-full h-full object-cover" 
                style={{
                  filter: 'contrast(1.1) brightness(1.05) saturate(1.1)'
                }}
              />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-2xl md:text-3xl text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.3)] filter brightness-125 contrast-125 text-3d-enhanced" 
                    style={{
                      textShadow: '2px 2px 4px rgba(0,0,0,0.7), 0 0 15px rgba(255,255,255,0.3), inset 0 1px 0 rgba(255,255,255,0.4), 0 1px 0 rgba(255,255,255,0.3), 0 2px 0 rgba(0,0,0,0.2), 0 3px 0 rgba(0,0,0,0.15), 0 4px 0 rgba(0,0,0,0.1)',
                      transform: 'perspective(500px) rotateX(3deg)',
                      filter: 'drop-shadow(0 6px 12px rgba(0,0,0,0.4)) drop-shadow(0 0 12px rgba(255,255,255,0.3))',
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 100%)',
                      WebkitBackgroundClip: 'text',
                      backgroundClip: 'text'
                    }}>
                هندسة السيارات
              </span>
              <span className="text-sm md:text-base text-gray-300 mt-1 text-inner-shadow" style={{
                textShadow: 'inset 0 1px 1px rgba(0,0,0,0.2), 0 1px 0 rgba(255,255,255,0.1)'
              }}>المساعد الذكي لاختيار زيت سيارتك</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/chat">
              <Button className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white border-0 px-8 py-3 text-lg font-bold btn-unified">
                <span className="flex items-center gap-2">
                  💬 بدء المحادثة
                </span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-8 md:py-12 px-4 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 bg-gradient-to-br from-orange-50 via-yellow-50 to-red-50 dark:from-gray-900 dark:via-gray-800 dark:to-orange-900/20"></div>
        <div className="absolute top-20 right-10 w-72 h-72 bg-orange-200/30 dark:bg-orange-500/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-yellow-200/30 dark:bg-yellow-500/10 rounded-full blur-3xl"></div>
        <div className="absolute inset-0 bg-[url('/engine-hero.jpg')] bg-cover bg-center opacity-5"></div>
        {/* Dark gradient overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/20 dark:from-black/20 dark:via-transparent dark:to-black/40"></div>

        <div className="relative max-w-7xl mx-auto text-center">
          {/* الشعار الكبير المحسن */}
          <div className="mb-4">
            <div className="relative flex items-center justify-center w-full">
              <div className="relative w-80 h-80 sm:w-96 sm:h-96 md:w-[400px] md:h-[400px] lg:w-[450px] lg:h-[450px] flex items-center justify-center">
                {/* Enhanced circular background with professional effects */}
                <div className="absolute inset-4 logo-circle-enhanced logo-badge-professional logo-metallic-effect rounded-full" aria-hidden="true"></div>
                
                {/* Logo image with enhanced sharpness */}
                <div className="relative z-20 w-3/4 h-3/4 flex items-center justify-center">
                  <Image
                    src="/logo.png"
                    alt="هندسة السيارات - مساعد زيوت السيارات الذكي"
                    width={300}
                    height={300}
                    priority
                    className="object-contain max-h-full max-w-full logo-text-sharp"
                    style={{
                      width: 'auto',
                      height: 'auto',
                      filter: 'contrast(1.5) brightness(1.3) saturate(1.4) drop-shadow(0 0 20px rgba(255,255,255,0.4))'
                    }}
                  />
                </div>
                
                {/* Much stronger gloss highlight */}
                <div className="absolute top-6 left-1/5 right-1/5 h-20 bg-gradient-to-r from-transparent via-white/60 to-transparent rounded-full blur-md opacity-80 z-10" aria-hidden="true"></div>
              </div>
            </div>
          </div>

          {/* النص التوضيحي تحت الشعار */}
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-8 leading-tight">
            <span className="bg-gradient-to-r from-red-600 via-orange-600 to-red-700 bg-clip-text text-transparent animate-gradient-text text-3d-enhanced text-arabic-3d" style={{
              filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.3)) drop-shadow(0 0 20px rgba(239, 68, 68, 0.4))'
            }}>
              المساعد الذكي لاختيار زيوت سيارتك
            </span>
          </h1>

          <p className="text-2xl md:text-3xl text-gray-700 dark:text-gray-200 mb-10 max-w-4xl mx-auto leading-relaxed text-embossed font-medium">
            احصل على توصيات دقيقة ومخصصة لاختيار أفضل زيت محرك لسيارتك
            <br />
            <span className="text-xl md:text-2xl text-red-600 dark:text-red-400 font-semibold text-inner-shadow mt-2 block" style={{
              textShadow: 'inset 0 1px 1px rgba(239, 68, 68, 0.2), 0 1px 0 rgba(255,255,255,0.1)',
              lineHeight: '1.6'
            }}>مناسب للظروف المناخية العراقية القاسية</span>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-12">
            <Link href="/chat">
              <Button size="lg" className="group relative overflow-hidden bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white border-0 px-12 py-8 text-xl font-bold btn-unified">
                <span className="relative z-10 flex items-center gap-3">
                  🚀 ابدأ المحادثة الآن
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="rounded-2xl px-10 py-6 text-lg font-semibold border-2 border-red-300 dark:border-red-600 hover:border-red-500 dark:hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300">
              📹 شاهد كيف يعمل
            </Button>
          </div>

          {/* Stats */}
          <div className="max-w-4xl mx-auto">
            <h3 className="text-2xl md:text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">لماذا تختارنا؟</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
                <div className="text-5xl font-black text-red-600 dark:text-red-400 mb-2">150+</div>
                <div className="text-gray-600 dark:text-gray-300 font-semibold">فلتر زيت معتمد</div>
              </div>
              <div className="text-center bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
                <div className="text-5xl font-black text-orange-600 dark:text-orange-400 mb-2">25+</div>
                <div className="text-gray-600 dark:text-gray-300 font-semibold">علامة تجارية</div>
              </div>
              <div className="text-center bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg">
                <div className="text-5xl font-black text-yellow-600 dark:text-yellow-400 mb-2">100%</div>
                <div className="text-gray-600 dark:text-gray-300 font-semibold">دقة التوصيات</div>
              </div>
            </div>
            <div className="text-center mt-8 p-4 bg-gradient-to-r from-green-100 to-blue-100 dark:from-green-900/30 dark:to-blue-900/30 rounded-xl">
              <p className="text-lg font-semibold text-green-800 dark:text-green-200">
                ✅ موصى به من خبراء الزيوت في العراق
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-4 bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              <span className="text-gray-900 dark:text-white">مميزات</span>
              <span className="bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent"> الخدمة</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              نقدم لك أفضل الحلول التقنية لاختيار زيت المحرك المناسب لسيارتك
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="group relative p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-gray-100 dark:border-gray-700">
              <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-orange-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative text-center">
                <div className="h-20 w-20 flex items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-red-600 text-white mb-4 text-4xl shadow-lg group-hover:scale-110 transition-transform duration-300 mx-auto">
                  🚗
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                  دعم شامل للسيارات
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                  توصيات دقيقة لأكثر من 25 علامة تجارية
                </p>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="group relative p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-gray-100 dark:border-gray-700">
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 to-yellow-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative text-center">
                <div className="h-20 w-20 flex items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-white mb-4 text-4xl shadow-lg group-hover:scale-110 transition-transform duration-300 mx-auto">
                  ⚡
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                  استجابة فورية
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                  توصيات دقيقة خلال ثوانٍ معدودة
                </p>
              </div>
            </div>

            {/* Feature 3 */}
            <div className="group relative p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-gray-100 dark:border-gray-700">
              <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-red-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative text-center">
                <div className="h-20 w-20 flex items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-500 to-yellow-600 text-white mb-4 text-4xl shadow-lg group-hover:scale-110 transition-transform duration-300 mx-auto">
                  ☀️
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white group-hover:text-yellow-600 dark:group-hover:text-yellow-400 transition-colors">
                  مناسب للمناخ العراقي
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                  مخصص للحرارة العالية والغبار
                </p>
              </div>
            </div>

            {/* Feature 4 */}
            <div className="group relative p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-gray-100 dark:border-gray-700">
              <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-emerald-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative text-center">
                <div className="h-20 w-20 flex items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-500 text-white mb-4 text-4xl shadow-lg group-hover:scale-110 transition-transform duration-300 mx-auto">
                  🛡️
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                  بيانات معتمدة 100%
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                  مستندة على كتالوجات رسمية معتمدة
                </p>
              </div>
            </div>

            {/* Feature 5 */}
            <div className="group relative p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-gray-100 dark:border-gray-700">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-indigo-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative text-center">
                <div className="h-20 w-20 flex items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 text-white mb-4 text-4xl shadow-lg group-hover:scale-110 transition-transform duration-300 mx-auto">
                  🔧
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  فلاتر الزيت والهواء
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                  أرقام فلاتر دقيقة مع مواعيد التغيير
                </p>
              </div>
            </div>

            {/* Feature 6 */}
            <div className="group relative p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 border border-gray-100 dark:border-gray-700">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative text-center">
                <div className="h-20 w-20 flex items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 text-white mb-4 text-4xl shadow-lg group-hover:scale-110 transition-transform duration-300 mx-auto">
                  💬
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                  دعم باللغة العربية
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                  واجهة عربية كاملة مع دعم متعدد اللغات
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Official Partner Banner */}
      <section className="py-16 bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
              شركاؤنا المعتمدون
            </h2>
            <p className="text-gray-600 dark:text-gray-300">نتعامل مع أفضل العلامات التجارية العالمية</p>
          </div>
          
          {/* Animated Slider */}
          <div className="relative overflow-hidden">
            <div className="flex animate-scroll space-x-8 rtl:space-x-reverse">
              {/* Oil Brand Logos */}
              <div className="flex-shrink-0 bg-white dark:bg-gray-700 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600">
                <div className="text-2xl font-bold text-red-600">Castrol</div>
              </div>
              <div className="flex-shrink-0 bg-white dark:bg-gray-700 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600">
                <div className="text-2xl font-bold text-blue-600">Mobil 1</div>
              </div>
              <div className="flex-shrink-0 bg-white dark:bg-gray-700 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600">
                <div className="text-2xl font-bold text-green-600">Liqui Moly</div>
              </div>
              <div className="flex-shrink-0 bg-white dark:bg-gray-700 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600">
                <div className="text-2xl font-bold text-purple-600">Valvoline</div>
              </div>
              <div className="flex-shrink-0 bg-white dark:bg-gray-700 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600">
                <div className="text-2xl font-bold text-orange-600">Motul</div>
              </div>
              <div className="flex-shrink-0 bg-white dark:bg-gray-700 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600">
                <div className="text-2xl font-bold text-indigo-600">Meguin</div>
              </div>
              <div className="flex-shrink-0 bg-white dark:bg-gray-700 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600">
                <div className="text-2xl font-bold text-yellow-600">Hanata</div>
              </div>
              {/* Duplicate for seamless loop */}
              <div className="flex-shrink-0 bg-white dark:bg-gray-700 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600">
                <div className="text-2xl font-bold text-red-600">Castrol</div>
              </div>
              <div className="flex-shrink-0 bg-white dark:bg-gray-700 p-6 rounded-xl shadow-lg border border-gray-200 dark:border-gray-600">
                <div className="text-2xl font-bold text-blue-600">Mobil 1</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Car Models Section */}
      <section className="py-16 px-4 bg-gray-50 dark:bg-gray-950">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-8 text-gray-900 dark:text-white">نماذج السيارات المدعومة</h2>

          {/* Tabs */}
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <button
              onClick={() => setFeaturedTab('jeep')}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all duration-300 ${featuredTab === 'jeep'
                ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'}`}
            >
              🚙 جيب
            </button>
            <button
              onClick={() => setFeaturedTab('toyota')}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all duration-300 ${featuredTab === 'toyota'
                ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'}`}
            >
              🚗 تويوتا
            </button>
            <button
              onClick={() => setFeaturedTab('hyundai')}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all duration-300 ${featuredTab === 'hyundai'
                ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'}`}
            >
              🚘 هيونداي
            </button>
            <button
              onClick={() => setFeaturedTab('kia')}
              className={`flex items-center gap-2 px-6 py-3 rounded-full font-semibold transition-all duration-300 ${featuredTab === 'kia'
                ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg'
                : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-700'}`}
            >
              🚕 كيا
            </button>
          </div>

          {/* Tab Content */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredTab === 'jeep' && (
              <>
                <div className="group bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100 dark:border-gray-700">
                  <div className="text-center">
                    <div className="text-3xl mb-2">🚙</div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">جيب كومباس</h3>
                    <div className="flex items-center justify-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                      <span className="flex items-center gap-1">🛢️ 0W-20</span>
                      <span className="flex items-center gap-1">📏 5.2L</span>
                    </div>
                  </div>
                </div>
                <div className="group bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100 dark:border-gray-700">
                  <div className="text-center">
                    <div className="text-3xl mb-2">🚙</div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">جراند شيروكي V6</h3>
                    <div className="flex items-center justify-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                      <span className="flex items-center gap-1">🛢️ 0W-20</span>
                      <span className="flex items-center gap-1">📏 5.7L</span>
                    </div>
                  </div>
                </div>
                <div className="group bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100 dark:border-gray-700">
                  <div className="text-center">
                    <div className="text-3xl mb-2">🚙</div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">جراند شيروكي V8</h3>
                    <div className="flex items-center justify-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                      <span className="flex items-center gap-1">🛢️ 5W-20</span>
                      <span className="flex items-center gap-1">📏 6.6L</span>
                    </div>
                  </div>
                </div>
                <div className="group bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100 dark:border-gray-700">
                  <div className="text-center">
                    <div className="text-3xl mb-2">🚙</div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">جيب رانجلر</h3>
                    <div className="flex items-center justify-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                      <span className="flex items-center gap-1">🛢️ 5W-30</span>
                      <span className="flex items-center gap-1">📏 5.0L</span>
                    </div>
                  </div>
                </div>
              </>
            )}
            {featuredTab === 'toyota' && (
              <>
                <div className="group bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100 dark:border-gray-700">
                  <div className="text-center">
                    <div className="text-3xl mb-2">🚗</div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">تويوتا كامري</h3>
                    <div className="flex items-center justify-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                      <span className="flex items-center gap-1">🛢️ 0W-20</span>
                      <span className="flex items-center gap-1">📏 4.5L</span>
                    </div>
                  </div>
                </div>
                <div className="group bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100 dark:border-gray-700">
                  <div className="text-center">
                    <div className="text-3xl mb-2">🚗</div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">تويوتا كورولا</h3>
                    <div className="flex items-center justify-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                      <span className="flex items-center gap-1">🛢️ 0W-20</span>
                      <span className="flex items-center gap-1">📏 4.2L</span>
                    </div>
                  </div>
                </div>
                <div className="group bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100 dark:border-gray-700">
                  <div className="text-center">
                    <div className="text-3xl mb-2">🚙</div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">لاندكروزر</h3>
                    <div className="flex items-center justify-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                      <span className="flex items-center gap-1">🛢️ 5W-30</span>
                      <span className="flex items-center gap-1">📏 6.8L</span>
                    </div>
                  </div>
                </div>
                <div className="group bg-white dark:bg-gray-800 p-4 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100 dark:border-gray-700">
                  <div className="text-center">
                    <div className="text-3xl mb-2">🚗</div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-2">تويوتا RAV4</h3>
                    <div className="flex items-center justify-center gap-4 text-sm text-gray-600 dark:text-gray-300">
                      <span className="flex items-center gap-1">🛢️ 0W-20</span>
                      <span className="flex items-center gap-1">📏 4.8L</span>
                    </div>
                  </div>
                </div>
              </>
            )}
            {featuredTab === 'hyundai' && (
              <>
                <div className="group bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center mb-4">
                    <div className="w-3 h-3 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full mr-3"></div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">هيونداي النترا</h3>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-semibold">نوع الزيت:</span> 5W-30 Full Synthetic</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-semibold">السعة:</span> 4.5 لتر</p>
                  </div>
                </div>
                <div className="group bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center mb-4">
                    <div className="w-3 h-3 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full mr-3"></div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">هيونداي سوناتا</h3>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-semibold">نوع الزيت:</span> 5W-30 Full Synthetic</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-semibold">السعة:</span> 4.8 لتر</p>
                  </div>
                </div>
                <div className="group bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center mb-4">
                    <div className="w-3 h-3 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full mr-3"></div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">هيونداي توسان</h3>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-semibold">نوع الزيت:</span> 5W-30 Full Synthetic</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-semibold">السعة:</span> 4.8 لتر</p>
                  </div>
                </div>
                <div className="group bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center mb-4">
                    <div className="w-3 h-3 bg-gradient-to-r from-blue-600 to-blue-700 rounded-full mr-3"></div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">هيونداي سانتافي</h3>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-semibold">نوع الزيت:</span> 5W-30 Full Synthetic</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-semibold">السعة:</span> 5.0 لتر</p>
                  </div>
                </div>
              </>
            )}
            {featuredTab === 'kia' && (
              <>
                <div className="group bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center mb-4">
                    <div className="w-3 h-3 bg-gradient-to-r from-red-500 to-red-600 rounded-full mr-3"></div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">كيا سيراتو</h3>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-semibold">نوع الزيت:</span> 5W-30 Full Synthetic</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-semibold">السعة:</span> 4.2 لتر</p>
                  </div>
                </div>
                <div className="group bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center mb-4">
                    <div className="w-3 h-3 bg-gradient-to-r from-red-500 to-red-600 rounded-full mr-3"></div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">كيا سبورتاج</h3>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-semibold">نوع الزيت:</span> 5W-30 Full Synthetic</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-semibold">السعة:</span> 4.6 لتر</p>
                  </div>
                </div>
                <div className="group bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center mb-4">
                    <div className="w-3 h-3 bg-gradient-to-r from-red-500 to-red-600 rounded-full mr-3"></div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">كيا K5</h3>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-semibold">نوع الزيت:</span> 5W-30 Full Synthetic</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-semibold">السعة:</span> 4.8 لتر</p>
                  </div>
                </div>
                <div className="group bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1 border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center mb-4">
                    <div className="w-3 h-3 bg-gradient-to-r from-red-500 to-red-600 rounded-full mr-3"></div>
                    <h3 className="font-bold text-lg text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">كيا سورينتو</h3>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-semibold">نوع الزيت:</span> 5W-30 Full Synthetic</p>
                    <p className="text-sm text-gray-600 dark:text-gray-300"><span className="font-semibold">السعة:</span> 5.2 لتر</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative py-20 px-4 overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700"></div>
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/5 rounded-full blur-3xl"></div>

        <div className="relative max-w-5xl mx-auto text-center">
          <div className="mb-6">
            <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-medium bg-white/20 text-white border border-white/30">
              🎯 جاهز للبدء؟
            </span>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold mb-6 text-white leading-tight">
            احصل على أفضل توصية
            <br />
            <span className="text-yellow-300">لسيارتك الآن</span>
          </h2>

          <p className="text-xl mb-10 text-blue-100 max-w-3xl mx-auto leading-relaxed">
            انضم إلى آلاف المستخدمين الذين يثقون بتوصياتنا المتخصصة
            <br />
            <span className="text-yellow-200 font-semibold">المساعد الذكي الأول في العراق لزيوت السيارات</span>
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
            <Link href="/chat">
              <Button size="lg" className="group relative overflow-hidden bg-white text-blue-600 hover:bg-gray-100 border-0 rounded-2xl px-10 py-6 text-lg font-bold shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300">
                <span className="relative z-10 flex items-center gap-2">
                  🚀 ابدأ المحادثة الآن
                </span>
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="rounded-2xl px-10 py-6 text-lg font-semibold border-2 border-white/30 text-white hover:bg-white/10 hover:border-white/50 transition-all duration-300">
              📞 تواصل معنا
            </Button>
          </div>

          {/* Trust indicators */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 opacity-80">
            <div className="flex items-center gap-2 text-white/90">
              <div className="w-2 h-2 bg-green-400 rounded-full"></div>
              <span className="text-sm font-medium">متاح 24/7</span>
            </div>
            <div className="flex items-center gap-2 text-white/90">
              <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
              <span className="text-sm font-medium">استجابة فورية</span>
            </div>
            <div className="flex items-center gap-2 text-white/90">
              <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
              <span className="text-sm font-medium">بيانات معتمدة</span>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-100 dark:bg-gray-900 py-12 px-4">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Image src="/logo.png" alt="هندسة السيارات" width={32} height={32} className="rounded-full" />
              <span className="font-bold text-gray-900 dark:text-white">هندسة السيارات</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              مساعد ذكي لاختيار أفضل زيت مناسب لسيارتك بناءً على الظروف المناخية العراقية
            </p>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 dark:text-white mb-4">روابط سريعة</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/chat" className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary">المحادثة</Link></li>
              <li><Link href="/about" className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary">عن الخدمة</Link></li>
              <li><Link href="/terms" className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary">الشروط والأحكام</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 dark:text-white mb-4">الدعم</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/faq" className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary">الأسئلة الشائعة</Link></li>
              <li><Link href="/contact" className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary">اتصل بنا</Link></li>
              <li><Link href="/privacy" className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary">سياسة الخصوصية</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-gray-900 dark:text-white mb-4">تواصل معنا</h4>
            <div className="flex space-x-4 rtl:space-x-reverse">
              <a href="https://www.facebook.com/share/16YBDa5FsY/" target="_blank" rel="noopener noreferrer" className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd"></path></svg>
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84"></path></svg>
              </a>
              <a href="https://www.instagram.com/carsiqmaysan?igsh=MWlmOHdoY2F3bnMyNg==" target="_blank" rel="noopener noreferrer" className="text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd"></path></svg>
              </a>
            </div>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-800 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">© 2025 هندسة السيارات. جميع الحقوق محفوظة.</p>
        </div>
      </footer>

      {/* Call to Action Section */}
      <section className="py-16 px-4 bg-gradient-to-r from-red-500 to-orange-500">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            جاهز لاختيار الزيت المناسب لسيارتك؟
          </h2>
          <p className="text-xl text-white/90 mb-8">
            احصل على توصيات دقيقة ومخصصة خلال دقائق
          </p>
          <Link href="/chat">
            <Button size="lg" className="bg-white text-red-600 hover:bg-gray-100 border-0 rounded-2xl px-12 py-8 text-xl font-bold shadow-2xl hover:shadow-3xl transform hover:scale-110 hover:-translate-y-2 transition-all duration-300">
              <span className="flex items-center gap-3">
                💬 ابدأ المحادثة الآن
              </span>
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
