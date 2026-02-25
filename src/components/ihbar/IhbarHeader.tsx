import { NavLink } from "react-router-dom";

interface IhbarHeaderProps {
  activeTab: string;
}

export default function IhbarHeader({ activeTab }: IhbarHeaderProps) {
  const tabs = [
    { id: '30isci', label: 'İş Kanununa Göre', path: '/ihbar/30isci' },
    { id: 'borclar', label: 'Borçlar Kanunu', path: '/ihbar/borclar' },
    { id: 'gemi', label: 'Gemi Adamları', path: '/ihbar/gemi' },
    { id: 'mevsim', label: 'Mevsimlik İşçi', path: '/ihbar/mevsim' },
    { id: 'basin', label: 'Basın İşçileri', path: '/ihbar/basin' },
    { id: 'toplu', label: 'Toplu İş Sözleşmesi', path: '/ihbar/toplu' },
    { id: 'part', label: 'Part Time', path: '/ihbar/part' },
    { id: 'parca', label: 'Parça Başı', path: '/ihbar/parca' },
    { id: 'kismi', label: 'Kısmi Süreli', path: '/ihbar/kismi' },
    { id: 'belirli', label: 'Belirli Süreli', path: '/ihbar/belirli' }
  ];

  return (
    <div className="bg-white shadow-sm mb-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => (
              <NavLink
                key={tab.id}
                to={tab.path}
                className={({ isActive }) =>
                  `whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`
                }
              >
                {tab.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
