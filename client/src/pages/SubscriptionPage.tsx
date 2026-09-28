import { CrownOutlined, CheckCircleFilled, ShoppingCartOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Empty,
  Row,
  Skeleton,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api";
import type { SubscriptionPlans, SubscriptionPlanBank } from "../types";

const { Title, Text, Paragraph } = Typography;

export default function SubscriptionPage() {
  const { t } = useTranslation();
  const { locale } = useParams<{ locale: string }>();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<SubscriptionPlans | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { plans: p } = await api.getSubscriptionPlans();
        if (cancelled) return;
        setPlans(p);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? t("error.server_error") : t("error.network_error"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [t]);

  const unsubscribedBanks = plans?.banks.filter((b) => !b.subscribed) ?? [];

  function handleToggleBank(bankId: string, checked: boolean) {
    setSelectedBankIds((prev) =>
      checked ? [...prev, bankId] : prev.filter((id) => id !== bankId)
    );
  }

  async function handlePurchaseFull() {
    if (unsubscribedBanks.length === 0) {
      messageApi.info(t("subscription.already_full"));
      return;
    }
    setPurchasing(true);
    try {
      const { result } = await api.purchaseSubscription("full");
      messageApi.success(
        t("subscription.purchase_success", { count: result.createdBankIds.length })
      );
      navigate(`/${locale}/banks`, { replace: true });
    } catch (err) {
      messageApi.error(t("subscription.purchase_failed"));
    } finally {
      setPurchasing(false);
    }
  }

  async function handlePurchaseSingle() {
    if (selectedBankIds.length === 0) {
      messageApi.warning(t("subscription.select_banks"));
      return;
    }
    setPurchasing(true);
    try {
      const { result } = await api.purchaseSubscription("single", selectedBankIds);
      if (result.createdBankIds.length > 0) {
        messageApi.success(
          t("subscription.purchase_success", { count: result.createdBankIds.length })
        );
        navigate(`/${locale}/banks`, { replace: true });
      } else {
        messageApi.info(t("subscription.already_subscribed"));
      }
    } catch (err) {
      messageApi.error(t("subscription.purchase_failed"));
    } finally {
      setPurchasing(false);
    }
  }

  if (loading) {
    return (
      <div className="page-container">
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container">
        <Alert type="error" showIcon message={error} />
      </div>
    );
  }

  if (!plans) return null;

  const allSubscribed = plans.banks.length > 0 && plans.banks.every((b) => b.subscribed);

  return (
    <div className="page-container">
      {contextHolder}
      <div className="page-heading">
        <Space direction="vertical" size={0}>
          <Title level={2} style={{ margin: 0 }}>{t("subscription.title")}</Title>
          <Text type="secondary">{t("subscription.subtitle")}</Text>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} lg={12}>
          <Card
            hoverable
            className={allSubscribed ? "" : "plan-card-highlight"}
            style={{ height: "100%" }}
          >
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <Space>
                <CrownOutlined style={{ fontSize: 28, color: "#faad14" }} />
                <Title level={4} style={{ margin: 0 }}>{t("subscription.full_plan")}</Title>
              </Space>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {t("subscription.full_description")}
              </Paragraph>
              <div>
                <Text strong style={{ fontSize: 32, color: "#1677ff" }}>
                  ¥{plans.fullSubscription.price}
                </Text>
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  / {plans.fullSubscription.durationDays}{t("subscription.days")}
                </Text>
              </div>
              {allSubscribed ? (
                <Tag icon={<CheckCircleFilled />} color="success">
                  {t("subscription.already_full")}
                </Tag>
              ) : (
                <Button
                  type="primary"
                  size="large"
                  block
                  icon={<ShoppingCartOutlined />}
                  loading={purchasing}
                  onClick={handlePurchaseFull}
                >
                  {t("subscription.buy_now")}
                </Button>
              )}
            </Space>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card style={{ height: "100%" }}>
            <Space direction="vertical" size="middle" style={{ width: "100%" }}>
              <Space>
                <Title level={4} style={{ margin: 0 }}>{t("subscription.per_bank_plan")}</Title>
              </Space>
              <Paragraph type="secondary" style={{ marginBottom: 0 }}>
                {t("subscription.per_bank_description")}
              </Paragraph>
              <div>
                <Text strong style={{ fontSize: 32, color: "#1677ff" }}>
                  ¥{plans.perBank.price}
                </Text>
                <Text type="secondary" style={{ marginLeft: 8 }}>
                  / {t("subscription.per_bank")}{t("subscription.days")}
                </Text>
              </div>
              <div>
                {plans.banks.length === 0 ? (
                  <Empty description={t("common.empty")} />
                ) : (
                  plans.banks.map((bank) => (
                    <BankRow
                      key={bank.id}
                      bank={bank}
                      price={plans.perBank.price}
                      checked={selectedBankIds.includes(bank.id)}
                      onToggle={(checked) => handleToggleBank(bank.id, checked)}
                    />
                  ))
                )}
              </div>
              {selectedBankIds.length > 0 && (
                <div style={{ textAlign: "right" }}>
                  <Text strong>
                    {t("common.total")}: ¥
                    {(plans.perBank.price * selectedBankIds.length).toFixed(2)}
                  </Text>
                </div>
              )}
              <Button
                size="large"
                block
                type="primary"
                ghost
                icon={<ShoppingCartOutlined />}
                loading={purchasing}
                disabled={selectedBankIds.length === 0}
                onClick={handlePurchaseSingle}
              >
                {t("subscription.buy_selected", { count: selectedBankIds.length })}
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>
    </div>
  );
}

function BankRow({
  bank,
  price,
  checked,
  onToggle,
}: {
  bank: SubscriptionPlanBank;
  price: number;
  checked: boolean;
  onToggle: (checked: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 0",
        borderBottom: "1px solid #f0f0f0",
      }}
    >
      <Checkbox
        checked={checked}
        onChange={(e) => onToggle(e.target.checked)}
        disabled={bank.subscribed}
      >
        <Space>
          <Tag color="blue">{t("bank.level_label", { level: bank.level })}</Tag>
          <Text>{bank.name}</Text>
          {bank.paperCount > 0 && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {bank.paperCount}{t("paper.paper_count")}
            </Text>
          )}
        </Space>
      </Checkbox>
      {bank.subscribed ? (
        <Tag icon={<CheckCircleFilled />} color="success">
          {t("bank.status_active")}
        </Tag>
      ) : (
        <Text type="secondary">¥{price}</Text>
      )}
    </div>
  );
}
