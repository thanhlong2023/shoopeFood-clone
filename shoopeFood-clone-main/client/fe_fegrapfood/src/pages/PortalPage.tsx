import { Link } from 'react-router-dom'
import { APP_NAME } from '../constants/app'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { useAuth } from '../contexts/AuthContext'

export default function PortalPage() {
  useDocumentTitle(`${APP_NAME} | Chọn Ứng Dụng`)
  const { hasRole } = useAuth()

  return (
    <div className="min-h-[85vh] flex flex-col items-center justify-center p-6 bg-gradient-to-b from-green-50 to-white">
      <div className="max-w-4xl w-full text-center mb-12 animate-fade-in-up">
        <h1 className="text-4xl md:text-5xl font-black text-gray-900 mb-4 tracking-tight">
          Chào mừng đến với <span className="text-[#00b14f]">{APP_NAME}</span>
        </h1>
        <p className="text-gray-500 text-lg max-w-2xl mx-auto">
          Nền tảng giao đồ ăn đa dịch vụ. Vui lòng chọn phân hệ ứng dụng để bắt đầu.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
        {/* Customer App Card */}
        <Link 
          to="/food"
          className="group relative flex flex-col items-center p-8 bg-white rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-[#00b14f]/30 transition-all duration-300 transform hover:-translate-y-2 no-underline"
        >
          <div className="w-24 h-24 rounded-2xl bg-green-50 text-[#00b14f] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Đặt món</h2>
          <p className="text-gray-500 text-center text-sm">
            Hàng ngàn món ngon giao tận nơi siêu tốc. Khám phá ngay!
          </p>
          <div className="mt-6 px-6 py-2 rounded-full bg-gray-50 text-[#00b14f] font-bold text-sm group-hover:bg-[#00b14f] group-hover:text-white transition-colors">
            Mở ứng dụng
          </div>
        </Link>

        {/* Merchant App Card */}
        <Link 
          to={hasRole(['MERCHANT']) ? "/merchant/orders" : "/merchant/login"}
          className="group relative flex flex-col items-center p-8 bg-white rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-orange-500/30 transition-all duration-300 transform hover:-translate-y-2 no-underline"
        >
          <div className="w-24 h-24 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Nhà hàng</h2>
          <p className="text-gray-500 text-center text-sm">
            Quản lý thực đơn, nhận đơn hàng và tăng doanh thu.
          </p>
          <div className="mt-6 px-6 py-2 rounded-full bg-gray-50 text-orange-500 font-bold text-sm group-hover:bg-orange-500 group-hover:text-white transition-colors">
            Mở ứng dụng
          </div>
        </Link>

        {/* Driver App Card */}
        <Link 
          to={hasRole(['DRIVER']) ? "/driver" : "/driver/login"}
          className="group relative flex flex-col items-center p-8 bg-white rounded-3xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-blue-500/30 transition-all duration-300 transform hover:-translate-y-2 no-underline"
        >
          <div className="w-24 h-24 rounded-2xl bg-blue-50 text-blue-500 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Tài xế</h2>
          <p className="text-gray-500 text-center text-sm">
            Nhận cuốc linh hoạt, thu nhập hấp dẫn mọi lúc mọi nơi.
          </p>
          <div className="mt-6 px-6 py-2 rounded-full bg-gray-50 text-blue-500 font-bold text-sm group-hover:bg-blue-500 group-hover:text-white transition-colors">
            Mở ứng dụng
          </div>
        </Link>
      </div>
    </div>
  )
}
