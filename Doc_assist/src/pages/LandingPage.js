import React from 'react';

import Header from '../components/Header/Header';
import Demo from '../components/Demo/Demo';
import Features from '../components/Features/Features';
import VSCodeSectionComponent from '../components/VSCode/VSCodeSection';
import Examples from '../components/Examples/Examples';
import Footer from '../components/Footer/Footer';

const LandingPage = () => {
  return (
    <>
      <Header />
      <main>
        <Demo />
        <Features />
        <VSCodeSectionComponent />
        <Examples />
      </main>
      <Footer />
    </>
  );
};

export default LandingPage;
