import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { festivalApi } from "./festival-api";
import "./festival-screen.css";

// Страница-приглашение на проектор: большой QR, чтобы зрители открыли нужную
// страницу у себя в телефоне и не толпились у экрана. Две цели: табло гонки и
// финальное голосование зала — раскладка одна, меняются адрес и подпись.
//
// Размеры в vh, поэтому 1920×1080 на проекторе заполняется целиком и без
// подгонки; на другом соотношении экран просто перестраивается.
//
// QR рисуется на месте, из библиотеки, а не запрашивается у чужого сервиса:
// на площадке интернет может лежать, а картинка нужна всегда.

export function QrPage({ target = "screen" }: { target?: "screen" | "vote" }) {
  const { slug = "" } = useParams();
  const [png, setPng] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const voting = target === "vote";

  const url = `${location.origin}/festival/${voting ? "vote" : "screen"}/${slug}`;
  // Короткая подпись под кодом: адрес без протокола читается легче.
  const shown = url.replace(/^https?:\/\//, "");

  useEffect(() => {
    let active = true;
    // Ленивый импорт: генератор нужен только на этой странице, отдельным чанком.
    void import("qrcode").then(async (qr) => {
      const data = await qr.toDataURL(url, {
        width: 1200,
        margin: 1,
        errorCorrectionLevel: "M",
        color: { dark: "#000a2e", light: "#ffffff" },
      });
      if (active) setPng(data);
    });
    return () => {
      active = false;
    };
  }, [url]);

  useEffect(() => {
    let active = true;
    festivalApi
      .board(slug)
      .then((b) => active && setTitle(b.race.title))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [slug]);

  return (
    <div className="fest fest--qr">
      <header className="fest-head">
        <h1 className="fest-title">{title ?? "Фестиваль"}</h1>
        <div className="fest-rule" />
      </header>

      <div className="fest-qr">
        <div className="fest-qr-card">
          {png ? (
            <img
              src={png}
              alt={voting ? "QR-код на голосование" : "QR-код на экран результатов"}
            />
          ) : (
            <div className="fest-qr-hold">…</div>
          )}
        </div>
        <div className="fest-qr-text">
          <div className="fest-qr-lead">
            {voting ? "Голосуй за финалиста" : "Наведи камеру телефона"}
          </div>
          <div className="fest-qr-sub">
            {voting
              ? "наведи камеру телефона и выбери одного — голос анонимный"
              : "и следи за гонкой у себя — результаты обновляются вживую"}
          </div>
          <div className="fest-qr-url">{shown}</div>
        </div>
      </div>
    </div>
  );
}
