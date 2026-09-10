import { Tooltip } from "@heroui/react";
import Link from "next/link";

export function OverLink() {
  return (
    <div className="h-0">
      <Tooltip content="Scrivici direttamente su whatsapp, basta un click!" placement="right">
        <Link href="https://wa.me/393484463000" target="_blank" className='fixed z-50 bottom-2 left-4 md:bottom-3 md:left-6 lg:bottom-8 lg:left-8 p-2 rounded-full bg-white iconoir-whatsapp-solid text-primary text-2xl lg:text-4xl hover:-translate-y-1 transition duration-300 border-1 border-neutral-500/10 shadow-sm hover:shadow-md' />

      </Tooltip>
    </div>
  )
}