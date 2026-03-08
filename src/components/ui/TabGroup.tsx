"use client";

type Props = {
  tabs: string[];
  activeTab: string;
  onChange: (tab: string) => void;
};

/** タブ切り替え UI */
export function TabGroup({ tabs, activeTab, onChange }: Props) {
  return (
    <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onChange(tab)}
          className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
            activeTab === tab
              ? "bg-white text-gray-900 shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}
