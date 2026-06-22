"use client"

import Link from "next/link"

import { useLocale } from "@/src/components/locale/provider"

const content = {
  brand: {
    ja: "PET TAXI",
    en: "PET TAXI",
    es: "PET TAXI",
  },
  site_map: {
    ja: "Site Map",
    en: "Site Map",
    es: "Site Map",
  },
  home: {
    ja: "Home",
    en: "Home",
    es: "Home",
  },
  partner: {
    ja: "Partner",
    en: "Partner",
    es: "Partner",
  },
  terms: {
    ja: "Terms",
    en: "Terms",
    es: "Terms",
  },
  privacy_policy: {
    ja: "Privacy Policy",
    en: "Privacy Policy",
    es: "Privacy Policy",
  },
  copyright: {
    ja: "© PET TAXI",
    en: "© PET TAXI",
    es: "© PET TAXI",
  },
}

export default function AppSiteFooter() {
  const { locale } = useLocale()

  return (
    <footer className="border-t border-[#ead7c3] bg-[#fff8ef] text-[#3d2a19]">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10">
        <p className="text-lg font-semibold">{content.brand[locale]}</p>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-[#8f5d28]">
              {content.site_map[locale]}
            </p>
            <ul className="space-y-2 text-sm leading-6 text-[#6f5842]">
              <li>
                <Link href="/app" className="transition hover:text-[#3d2a19]">
                  {content.home[locale]}
                </Link>
              </li>
              <li>
                <Link href="/partner" className="transition hover:text-[#3d2a19]">
                  {content.partner[locale]}
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <ul className="space-y-2 text-sm leading-6 text-[#6f5842]">
              <li>{content.terms[locale]}</li>
              <li>{content.privacy_policy[locale]}</li>
            </ul>
          </div>
        </div>

        <p className="text-xs text-[#8c7358]">{content.copyright[locale]}</p>
      </div>
    </footer>
  )
}
