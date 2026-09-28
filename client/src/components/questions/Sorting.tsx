import { Button, Space } from "antd";
import { ArrowDownOutlined, ArrowUpOutlined } from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import type { SortingPayload } from "../../types";
import type { QuestionRendererProps } from "./types";

export default function Sorting({ question, value, onChange, disabled }: QuestionRendererProps) {
  const { t } = useTranslation();
  const payload = question.payload as SortingPayload;
  const order = value?.type === "order" ? value.value : payload.items.map((i) => i.key);

  function move(index: number, direction: -1 | 1) {
    const next = [...order];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ type: "order", value: next });
  }

  const itemMap = new Map(payload.items.map((i) => [i.key, i.text]));

  return (
    <div className="question-body">
      <div className="sorting-list">
        {order.map((key, idx) => (
          <div key={key} className="sorting-item">
            <span className="sorting-number">{idx + 1}</span>
            <span className="sorting-text">{itemMap.get(key) ?? key}</span>
            <Space className="sorting-actions">
              <Button
                size="small"
                icon={<ArrowUpOutlined />}
                disabled={disabled || idx === 0}
                onClick={() => move(idx, -1)}
                aria-label={t("exam.prev")}
              />
              <Button
                size="small"
                icon={<ArrowDownOutlined />}
                disabled={disabled || idx === order.length - 1}
                onClick={() => move(idx, 1)}
                aria-label={t("exam.next")}
              />
            </Space>
          </div>
        ))}
      </div>
    </div>
  );
}
