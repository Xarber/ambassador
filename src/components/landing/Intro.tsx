import Image from "next/image";
import Sep from "./Sep";

import partyparrot from "@/assets/landing/emoji/partyparrot.gif";

import { useMessages, useTranslations } from "next-intl";
import Link from "next/link";
export default function Intro() {
  const t = useTranslations("landing");
  const messages = useMessages();
  const introKeys = Object.keys(messages.landing.intro).filter((key) =>
    Number.isFinite(Number(key)),
  );

  return (
    <div className="p-12 relative">
      <Sep className="absolute top-0 -translate-y-1/2 inset-x-0" />
      <p className="text-neutral-500 text-xl font-jersey">
        --- START OF MESSAGE ---
      </p>
      <div className="leading-relaxed text-2xl md:text-3xl text-pretty space-y-4 mt-4">
        {introKeys.map((key) => (
          <p key={key}>
            {t.rich(`intro.${key}`, {
              strong: (chunks) => <strong>{chunks}</strong>,
              partyparrot: () => (
                <Image
                  src={partyparrot}
                  alt=""
                  className="size-8 object-contain inline-block mb-1.5 ml-1"
                />
              ),
            })}
          </p>
        ))}

        <Link
          href="/apply"
          className="mt-4 max-w-fit corner-squircle rounded-full hover:scale-105 transition hover:bg-rose-700 bg-primary text-white h-14 px-5 flex items-center"
        >
          <span className="font-jersey text-3xl uppercase">{t("apply")}</span>
        </Link>
        <p className="mt-4 text-neutral-600 text-sm">{t("apply-sub")}</p>
        <p className="text-neutral-500 mt-4 text-xl font-jersey">&lt;&lt;EOF</p>
      </div>
    </div>
  );
}
