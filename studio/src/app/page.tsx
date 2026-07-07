import { Header } from '@/components/landing/header';
import { Hero } from '@/components/landing/hero';
import { HowItWorks } from '@/components/landing/how-it-works';
import { Features } from '@/components/landing/features';
import { ThemeGallery } from '@/components/landing/theme-gallery';
import { NoBlackBox } from '@/components/landing/no-black-box';
import { FinalCta, Footer } from '@/components/landing/final-cta';

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <ThemeGallery />
        <NoBlackBox />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
