// components/CraftsmanCard.tsx
import React from "react";
import { Star } from "lucide-react";

interface CraftsmanProps {
  id: string;
  name: string;
  craft: string;
  rating?: number;
  reviewCount?: number;
  address?: string;
  description?: string;
  status?: string;
}

export const CraftsmanCard: React.FC<CraftsmanProps> = ({
  id,
  name,
  craft,
  rating = 0,
  reviewCount = 0,
  address = "",
  description = "",
  status = "free",
}) => {
  // Format description to be shorter if too long
  const shortDescription = description
    ? description.length > 100
      ? description.substring(0, 100) + "..."
      : description
    : "لا يوجد وصف متاح";

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-200">
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center text-indigo-600 dark:text-indigo-300">
              {name.charAt(0)}
            </div>
            <div>
              <h3 className="font-medium text-slate-900 dark:text-slate-100">{name}</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">{craft}</p>
            </div>
          </div>
          <div className="flex items-center">
            {status === "free" ? (
              <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                متاح
              </span>
            ) : (
              <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">
                مشغول
              </span>
            )}
          </div>
        </div>

        <div className="mt-3">
          {address && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
              {address}
            </p>
          )}
          <p className="text-sm text-slate-600 dark:text-slate-300 mt-2">{shortDescription}</p>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center">
            <div className="flex items-center">
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              <span className="text-sm font-medium ml-1 mr-1">
                {rating ? rating.toFixed(1) : "جديد"}
              </span>
            </div>
            {reviewCount > 0 && (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                ({reviewCount} تقييم)
              </span>
            )}
          </div>
          <a
            href={`/craftsman/${id}`}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium"
          >
            عرض الملف
          </a>
        </div>
      </div>
    </div>
  );
};