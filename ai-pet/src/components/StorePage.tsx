import { useMemo, useState } from "react";
import { effectHintForProduct, ownsProduct, type PetInventoryState } from "../data/petInventory";
import {
  STORE_FILTERS,
  BEHAVIOR_STORE_PRODUCTS,
  type StoreCategory,
  type StoreFilter,
} from "../data/storeProducts";
import "./StorePage.css";

type StorePageProps = {
  yarnCoins: number;
  activeCategory: StoreCategory;
  inventory: PetInventoryState;
  onBuy: (productId: string, price: number, name: string) => boolean;
  onOpenInventory?: () => void;
};

export function StorePage({ yarnCoins, activeCategory, inventory, onBuy, onOpenInventory }: StorePageProps) {
  const [activeFilter, setActiveFilter] = useState<StoreFilter>("new");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = useMemo(() => {
    const list = BEHAVIOR_STORE_PRODUCTS.filter((product) => {
      const categoryMatch = activeCategory === "all" || product.category === activeCategory;
      const searchMatch =
        searchQuery.trim() === "" ||
        product.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
      return categoryMatch && searchMatch;
    });
    return [...list].sort((a, b) => {
      if (a.filter === activeFilter && b.filter !== activeFilter) return -1;
      if (b.filter === activeFilter && a.filter !== activeFilter) return 1;
      return 0;
    });
  }, [activeCategory, activeFilter, searchQuery]);

  return (
    <div className="store-page">
      <header className="store-header">
        <h1 className="store-title">心情小铺</h1>
        <div className="store-header-actions">
          <div className="coin-badge">
            <span className="coin-icon" aria-hidden>
              🐷
            </span>
            <strong>{yarnCoins.toLocaleString()}</strong>
            <span>毛线币</span>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="搜索商品"
            onClick={() => {
              const q = window.prompt("搜索商品名称", searchQuery);
              if (q !== null) setSearchQuery(q);
            }}
          >
            🔍
          </button>
          <button type="button" className="store-bag-btn" onClick={onOpenInventory}>
            🎒 我的物品
          </button>
          <button type="button" className="avatar-btn" aria-label="用户资料">
            Y
          </button>
        </div>
      </header>

      <div className="store-filters">
        {STORE_FILTERS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeFilter === tab.id ? "active" : ""}
            onClick={() => setActiveFilter(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="store-grid">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((product) => {
            const owned = ownsProduct(inventory, product.id);
            const equipped =
              inventory.equippedHead === product.id ||
              inventory.equippedBuffs.includes(product.id) ||
              inventory.equippedPersonalities?.includes(product.id) ||
              inventory.equippedCorner === product.id;
            return (
            <article
              key={product.id}
              className={`product-card${
                product.category === "curiosity"
                  ? " product-card--curiosity"
                  : product.category === "personality"
                    ? " product-card--spirit"
                    : product.category === "accessory"
                      ? " product-card--buff"
                        : ""
              }`}
            >
              <div
                className="product-image"
                style={{ background: product.gradient }}
              >
                {product.category === "personality" ? (
                  <span className="product-badge product-badge--spirit">人格</span>
                ) : null}
                {product.category === "curiosity" ? (
                  <span className="product-badge">奇趣</span>
                ) : null}
                {product.category === "accessory" ? (
                  <span className="product-badge product-badge--buff">Buff</span>
                ) : null}
                <span className="product-emoji">{product.emoji}</span>
              </div>
              <h3>{product.name}</h3>
              <p className="product-tagline">{product.tagline}</p>
              <p className="product-effect-hint">{effectHintForProduct(product.id)}</p>
              <div className="product-footer">
                <span className="product-price">
                  <span aria-hidden>🐷</span> {product.price}
                </span>
                {owned ? (
                  <span className="product-owned-badge">{equipped ? "装备中" : "已拥有"}</span>
                ) : (
                <button
                  type="button"
                  className="buy-btn"
                  onClick={() => onBuy(product.id, product.price, product.name)}
                >
                  {product.price === 0 ? "免费领取" : "购买"}
                </button>
                )}
              </div>
            </article>
          );
          })
        ) : (
          <p className="store-empty">暂无符合条件的商品，换个分类试试吧。</p>
        )}
      </div>

      <button type="button" className="store-fab" aria-label="商店提示">
        💡
      </button>
    </div>
  );
}
