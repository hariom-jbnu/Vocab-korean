
import React from 'react';
import { ThemeColors } from '../types';

interface ContactProps {
  theme: ThemeColors;
}

const Contact: React.FC<ContactProps> = ({ theme }) => {
  return (
    <div className="w-full max-w-4xl animate-fadeIn py-4">
      <div className="bg-white rounded-[2.5rem] shadow-xl overflow-hidden border border-black/5" style={{ color: '#111827' }}>
        <div className="p-8 md:p-12">
          <div className="mb-10 text-center">
            <h1 className="text-4xl font-black tracking-tight mb-2">Support & Feedback</h1>
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">Your voice helps us grow</p>
          </div>

          <div className="relative w-full rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 shadow-inner" style={{ height: '550px' }}>
            <iframe 
              src="https://docs.google.com/forms/d/e/1FAIpQLSe9_2GxB2CaI3zhFe0ugyq1vhI9Le_UFV7jziLaOdrA25KSNg/viewform?embedded=true" 
              className="absolute top-0 left-0 w-full h-full border-0"
              title="Contact Form"
            >
              Loading form…
            </iframe>
          </div>

          <div className="mt-10 flex justify-center items-center gap-6 border-t border-gray-50 pt-8">
            <a 
              href="https://github.com/py-hariom" 
              target="_blank" 
              rel="noopener noreferrer"
              className="group flex items-center gap-4 hover:opacity-80 transition-all"
            >
              <div className="w-10 h-10 bg-gray-900 text-white rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                 <i className="bi bi-github"></i>
              </div>
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Lead Developer</span>
                <span className="font-bold border-b border-transparent group-hover:border-current">@hariom-jbnu</span>
              </div>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Contact;
