// components/CraftsmenGrid.tsx
import React from "react";
import { CraftsmanCard } from "./CraftsmanCard";

interface Craftsman {
  id: string;
  name: string;
  craft: string;
  rating?: number;
  reviewCount?: number;
  address?: string;
  description?: string;
  status?: string;
}

interface CraftsmenGridProps {
  craftsmen: Craftsman[];
}

export const CraftsmenGrid: React.FC<CraftsmenGridProps> = ({ craftsmen }) => {
  if (!craftsmen || craftsmen.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
      {craftsmen.map((craftsman) => (
        <CraftsmanCard key={craftsman.id} {...craftsman} />
      ))}
    </div>
  );
};