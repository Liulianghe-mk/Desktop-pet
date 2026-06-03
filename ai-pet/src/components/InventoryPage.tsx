import {
  effectHintForProduct,
  equipBuff,
  equipPersonality,
  getEquippedPersonalityProducts,
  removeOwnedProduct,
  type PetInventoryState,
} from "../data/petInventory";
import { getStoreProduct } from "../data/storeProducts";
import "./InventoryPage.css";

type InventoryPageProps = {
  inventory: PetInventoryState;
  onChange: (next: PetInventoryState) => void;
  onNotify: (message: string) => void;
};

export function InventoryPage({ inventory, onChange, onNotify }: InventoryPageProps) {
  const ownedProducts = inventory.owned
    .map((id) => getStoreProduct(id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .filter((p) => p.category !== "head" && p.category !== "furniture");

  const personalityEquipped = getEquippedPersonalityProducts(inventory);

  return (
    <div className="inventory-page">
      <header className="inventory-header">
        <h1 className="inventory-title">我的物品</h1>
        <p className="inventory-subtitle">装备人格插件、激活 Buff，也可以删除不需要的商品</p>
      </header>

      <section className="inventory-equipped-summary">
        <h2>当前生效</h2>
        <ul>
          <li>
            <span>人格槽</span>
            <strong>
              {personalityEquipped.length
                ? personalityEquipped.map((p) => `${p.emoji} ${p.name}`).join(" + ")
                : "未装备"}
            </strong>
          </li>
          <li>
            <span>Buff 槽 1</span>
            <strong>
              {inventory.equippedBuffs[0]
                ? getStoreProduct(inventory.equippedBuffs[0])?.name ?? "—"
                : "空"}
            </strong>
          </li>
          <li>
            <span>Buff 槽 2</span>
            <strong>
              {inventory.equippedBuffs[1]
                ? getStoreProduct(inventory.equippedBuffs[1])?.name ?? "—"
                : "空"}
            </strong>
          </li>
        </ul>
      </section>

      {ownedProducts.length === 0 ? (
        <p className="inventory-empty">还没有物品，去心情小铺逛逛吧。</p>
      ) : (
        <div className="inventory-list">
          {ownedProducts.map((product) => {
            const isPersonality = product.effectType === "personality";
            const isBuff = product.effectType === "buff";
            const personalitySlot = inventory.equippedPersonalities?.[0] === product.id
              ? 0
              : inventory.equippedPersonalities?.[1] === product.id
                ? 1
                : null;
            const buffSlot = inventory.equippedBuffs[0] === product.id
              ? 0
              : inventory.equippedBuffs[1] === product.id
                ? 1
                : null;
            return (
              <article key={product.id} className="inventory-card">
                <div className="inventory-card-visual" style={{ background: product.gradient }}>
                  <span>{product.emoji}</span>
                </div>
                <div className="inventory-card-body">
                  <h3>{product.name}</h3>
                  <p className="inventory-card-hint">{effectHintForProduct(product.id)}</p>
                  <div className="inventory-card-actions">
                    {isPersonality ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const next = equipPersonality(inventory, 0, product.id);
                            onChange(next);
                            onNotify(`「${product.name}」已放入人格槽 1`);
                          }}
                        >
                          装备槽1{personalitySlot === 0 ? " ✓" : ""}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = equipPersonality(inventory, 1, product.id);
                            onChange(next);
                            onNotify(`「${product.name}」已放入人格槽 2`);
                          }}
                        >
                          装备槽2{personalitySlot === 1 ? " ✓" : ""}
                        </button>
                        {(personalitySlot === 0 || personalitySlot === 1) && (
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => {
                              const slot = personalitySlot as 0 | 1;
                              const next = equipPersonality(inventory, slot, null);
                              onChange(next);
                              onNotify(`已卸下人格「${product.name}」`);
                            }}
                          >
                            卸下
                          </button>
                        )}
                      </>
                    ) : null}
                    {isBuff ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const next = equipBuff(inventory, 0, product.id);
                            onChange(next);
                            onNotify(`「${product.name}」已放入 Buff 槽 1`);
                          }}
                        >
                          槽1{buffSlot === 0 ? " ✓" : ""}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const next = equipBuff(inventory, 1, product.id);
                            onChange(next);
                            onNotify(`「${product.name}」已放入 Buff 槽 2`);
                          }}
                        >
                          槽2{buffSlot === 1 ? " ✓" : ""}
                        </button>
                        {(buffSlot === 0 || buffSlot === 1) && (
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => {
                              const slot = buffSlot as 0 | 1;
                              const next = equipBuff(inventory, slot, null);
                              onChange(next);
                              onNotify(`已卸下 Buff「${product.name}」`);
                            }}
                          >
                            卸下
                          </button>
                        )}
                      </>
                    ) : null}
                    <button
                      type="button"
                      className="danger"
                      onClick={() => {
                        if (!window.confirm(`确定删除「${product.name}」吗？删除后需要重新购买。`)) {
                          return;
                        }
                        const next = removeOwnedProduct(inventory, product.id);
                        onChange(next);
                        onNotify(`已删除「${product.name}」`);
                      }}
                    >
                      删除
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
