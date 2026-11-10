
import React from 'react';
import { Link } from 'react-router-dom';
import { ThemeColors } from '../types';
import { contrastText } from '../lib/color';

interface FooterProps {
  theme: ThemeColors;
}

const Footer: React.FC<FooterProps> = ({ theme }) => {
  const isDarkBg = contrastText(theme.background) !== '#0F172A';
  const colorBase = isDarkBg ? 'text-white/60' : 'text-gray-500';
  const hoverBase = isDarkBg ? 'hover:text-white' : 'hover:text-black';

  return (
    <footer className={`w-full py-2 mt-auto bg-transparent border-t border-black/5 ${colorBase}`}>
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center justify-between w-full h-8">
          {/* Left: Navigation (Order: home, contact, faq, site map, manual) */}
          <nav className="flex items-center gap-3 text-[9px] font-black uppercase tracking-[0.1em]">
            <Link to="/" title="Home" className={`transition-all hover:scale-125 ${hoverBase}`}>
              <i className="bi bi-house-fill text-base"></i>
            </Link>
            <span className="opacity-20 select-none">|</span>
            <Link to="/contact" title="Contact Us" className={`transition-all hover:scale-125 ${hoverBase}`}>
              <i className="bi bi-person-lines-fill text-base"></i>
            </Link>
            <span className="opacity-20 select-none">|</span>
            <a href="#" className={`transition-colors ${hoverBase}`}>FAQ</a>
            <span className="opacity-20 select-none">|</span>
            <a href="#" className={`transition-colors ${hoverBase}`}>Site Map</a>
            <span className="opacity-20 select-none">|</span>
            <a href="#" className={`transition-colors ${hoverBase}`}>Manual</a>
          </nav>

          {/* Right: GitHub Logo */}
          <a 
            href="https://github.com/hariom-jbnu" 
            target="_blank" 
            rel="noopener noreferrer"
            className={`text-lg transition-all hover:scale-110 active:scale-90 ${hoverBase}`}
            title="GitHub"
          >
            <i className="bi bi-github"></i>
          </a>
        </div>
        
        {/* Tiny Copyright beneath the navigation line */}
        <div className="text-[7px] font-black tracking-[0.2em] opacity-30 select-none text-left">
          Right Reserved
        </div>
      </div>
    </footer>
  );
};

export default Footer;
