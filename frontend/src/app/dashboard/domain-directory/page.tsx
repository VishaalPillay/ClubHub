export default function DomainDirectoryPage() {
  return (
    <div className="w-full flex flex-col gap-8">
      {/* Editorial Ribbon */}
      <div className="bg-black w-full mb-6 flex justify-between items-center px-2 py-1">
        <h1 className="text-white font-mono text-12 uppercase tracking-widest">Domain Directory</h1>
        <button className="bg-white text-black font-ui text-12 px-2 py-0.5 border-2 border-black hover:bg-black hover:text-white transition-0 uppercase">New Domain</button>
      </div>

      {/* 2x2 Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Domain Card: Technical */}
        <article className="flex flex-col border-2 border-black rounded-none group hover:border-[3px] transition-all duration-75 cursor-pointer bg-white relative">
          <div className="w-full h-64 border-b-2 border-black bg-[#e2e2e2] overflow-hidden">
            <img
              alt="Abstract server racks"
              className="w-full h-full object-cover filter grayscale contrast-125 group-hover:scale-105 transition-transform duration-500 ease-in-out"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAjy39WAPpGxTyzwmG8Zi9Etj38kUgDGh1dIUQXjLb2q73_IlPL_iyoO1NPObIhQDxHwl6jfx2H3nRMAAdsOhhkTOlHs6GB80Hb5A5LDO-lI2o8f0OqxyVrmOeDDyn-pm82CGCK2xIVf_pHLQK1cikg0MD86RzlGR4K32jY198WnnTOIBDQcW8mQ2VUj5q_eE8Da7x_8NJh9Cx_LUM7mO7bibZ7SDW8HGq7Xy_zhAVpa1SgcOjlXItDYO_EQKMkOsYFbbUiINbs9lXt"
            />
          </div>
          <div className="p-4 flex flex-col flex-1">
            <h2 className="font-display text-[26px] leading-[1.18] text-black uppercase mb-2 group-hover:text-[#057DBC] transition-colors">
              Technical
            </h2>
            <p className="font-body text-[16px] leading-[1.50] text-[#757575] mb-6">
              Engineering, development, and IT infrastructure management across global systems.
            </p>
            <div className="mt-auto pt-4 border-t border-[#E2E8F0] flex justify-between items-center">
              <div className="bg-[#057DBC] text-white font-mono text-[12px] tracking-[1.1px] px-2 py-1 uppercase">
                TOTAL MEMBERS: 142
              </div>
              <span className="material-symbols-outlined text-[#057DBC] opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontVariationSettings: "'FILL' 0" }}>
                arrow_forward
              </span>
            </div>
          </div>
        </article>

        {/* Domain Card: Corporate */}
        <article className="flex flex-col border-2 border-black rounded-none group hover:border-[3px] transition-all duration-75 cursor-pointer bg-white relative">
          <div className="w-full h-64 border-b-2 border-black bg-[#e2e2e2] overflow-hidden">
            <img
              alt="Abstract skyscraper facade"
              className="w-full h-full object-cover filter grayscale contrast-125 group-hover:scale-105 transition-transform duration-500 ease-in-out"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDsTdyn8-sgGGtH634r7rTqftF6uxvpKxB75Pxj4r8xzYa3ll82KJYECL7u8z7y2z58XiwNSpYHL8gouo2ZoUA_H0C-bq1s0F6gD5k2QTa6Xx7HOXhFE0Au-eLnaziHVFtLsVJyfeHlDFWYpOkh_5Bleb6re-SF04Gvyi4k86Vk-zi_vHUImpc3IRZwjDzan-BfmYeqarkcOcWlYS8jgH2S2FNdrdZ8zA40IE8LQ8VoTmzzSDnpUBiIjb6d6aDfuYB2K7JiyvpE9hbJ"
            />
          </div>
          <div className="p-4 flex flex-col flex-1">
            <h2 className="font-display text-[26px] leading-[1.18] text-black uppercase mb-2 group-hover:text-[#057DBC] transition-colors">
              Corporate
            </h2>
            <p className="font-body text-[16px] leading-[1.50] text-[#757575] mb-6">
              Legal, finance, human resources, and high-level strategic operations.
            </p>
            <div className="mt-auto pt-4 border-t border-[#E2E8F0] flex justify-between items-center">
              <div className="bg-[#057DBC] text-white font-mono text-[12px] tracking-[1.1px] px-2 py-1 uppercase">
                TOTAL MEMBERS: 87
              </div>
              <span className="material-symbols-outlined text-[#057DBC] opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontVariationSettings: "'FILL' 0" }}>
                arrow_forward
              </span>
            </div>
          </div>
        </article>

        {/* Domain Card: Creative */}
        <article className="flex flex-col border-2 border-black rounded-none group hover:border-[3px] transition-all duration-75 cursor-pointer bg-white relative">
          <div className="w-full h-64 border-b-2 border-black bg-[#e2e2e2] overflow-hidden">
            <img
              alt="Abstract geometric shapes"
              className="w-full h-full object-cover filter grayscale contrast-125 group-hover:scale-105 transition-transform duration-500 ease-in-out"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuAa5ImWwisPmCtoR5S1Fjd4_1qkmqmiUvl7KACXYDcl9V4rjMDTZBJw7Z2RS0Cp3VmzbFD16M5cOm7M25KzyrTBYLtl4j5UiQCRRMJ9TcuELpZ9m-RBAEySYuL-4x67wokQuwmw61uZnrUDeaZRkvHapoeVjjafx1i7vXIiv3DrdiscEE5YBLPGOCzx7Rth3c2ax5DxLoyGzKPnM5uXBhMnPx6aCwftFCNdTT1sWsQHiuICqwoyUO01eqfrtGfPyY0PLETqwjCd49rH"
            />
          </div>
          <div className="p-4 flex flex-col flex-1">
            <h2 className="font-display text-[26px] leading-[1.18] text-black uppercase mb-2 group-hover:text-[#057DBC] transition-colors">
              Creative
            </h2>
            <p className="font-body text-[16px] leading-[1.50] text-[#757575] mb-6">
              Design, content production, brand identity, and user experience research.
            </p>
            <div className="mt-auto pt-4 border-t border-[#E2E8F0] flex justify-between items-center">
              <div className="bg-[#057DBC] text-white font-mono text-[12px] tracking-[1.1px] px-2 py-1 uppercase">
                TOTAL MEMBERS: 115
              </div>
              <span className="material-symbols-outlined text-[#057DBC] opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontVariationSettings: "'FILL' 0" }}>
                arrow_forward
              </span>
            </div>
          </div>
        </article>

        {/* Domain Card: Management */}
        <article className="flex flex-col border-2 border-black rounded-none group hover:border-[3px] transition-all duration-75 cursor-pointer bg-white relative">
          <div className="w-full h-64 border-b-2 border-black bg-[#e2e2e2] overflow-hidden">
            <img
              alt="Abstract stairs"
              className="w-full h-full object-cover filter grayscale contrast-125 group-hover:scale-105 transition-transform duration-500 ease-in-out"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuB_D6OHLgtXVSf01RPCICRb-FNBLDFpH0P0ZY23a2VY0K9_Zs4BGIIZswcWwJ0S2jGLwG_OweA9NP4hpq4KqoeZTPHyfhIKzkgqAp8-2YqOVsjIVw_SVCx3xlmAWloxLJ3PsmmVXWyiLUhzU4SRpISpxoG-TvkiTOERP-3TpkRIfngzwbK2Edu_NonFWNoPpbQ0VJw5Ef2VfFjqqAJQs5r9ALET8FwtqFxUa-ea7g-Tsxy5MjUyEhjatP2kUzczGXUgxt3uGdjHLeXZ"
            />
          </div>
          <div className="p-4 flex flex-col flex-1">
            <h2 className="font-display text-[26px] leading-[1.18] text-black uppercase mb-2 group-hover:text-[#057DBC] transition-colors">
              Management
            </h2>
            <p className="font-body text-[16px] leading-[1.50] text-[#757575] mb-6">
              Product leadership, project management, and cross-functional team coordination.
            </p>
            <div className="mt-auto pt-4 border-t border-[#E2E8F0] flex justify-between items-center">
              <div className="bg-[#057DBC] text-white font-mono text-[12px] tracking-[1.1px] px-2 py-1 uppercase">
                TOTAL MEMBERS: 54
              </div>
              <span className="material-symbols-outlined text-[#057DBC] opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontVariationSettings: "'FILL' 0" }}>
                arrow_forward
              </span>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
