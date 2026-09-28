import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../../api";
import type { AdminKnowledgeCategory, AdminKnowledgeDocument } from "../../types";

type CategoryFormValues = {
  name: string;
  bankId?: string | null;
  description?: string;
  displayOrder: number;
  status: "draft" | "published";
};

type DocumentFormValues = {
  categoryId: string;
  title: string;
  content: string;
  tags?: string[];
  displayOrder: number;
  status: "draft" | "published";
};

export default function AdminKnowledgePage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<AdminKnowledgeCategory[]>([]);
  const [documents, setDocuments] = useState<AdminKnowledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("categories");
  const [editingCategory, setEditingCategory] = useState<AdminKnowledgeCategory | null>(null);
  const [editingDocument, setEditingDocument] = useState<AdminKnowledgeDocument | null>(null);
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [categoryForm] = Form.useForm<CategoryFormValues>();
  const [documentForm] = Form.useForm<DocumentFormValues>();

  useEffect(() => { void loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [categoryResponse, documentResponse] = await Promise.all([
        api.adminGetKnowledgeCategories(),
        api.adminGetKnowledgeDocuments(),
      ]);
      setCategories(categoryResponse.categories);
      setDocuments(documentResponse.documents);
      setError(null);
    } catch {
      setError("error.server_error");
    } finally {
      setLoading(false);
    }
  }

  function openCategoryModal(category?: AdminKnowledgeCategory) {
    setEditingCategory(category ?? null);
    categoryForm.setFieldsValue(category ?? {
      name: "",
      bankId: undefined,
      description: "",
      displayOrder: categories.length + 1,
      status: "published",
    });
    setCategoryModalOpen(true);
  }

  function openDocumentModal(document?: AdminKnowledgeDocument) {
    setEditingDocument(document ?? null);
    documentForm.setFieldsValue(document ?? {
      categoryId: categories[0]?.id,
      title: "",
      content: "",
      tags: [],
      displayOrder: documents.length + 1,
      status: "draft",
    });
    setDocumentModalOpen(true);
  }

  async function handleCategoryStatusChange(categoryId: string, status: string) {
    try {
      await api.adminUpdateKnowledgeCategory(categoryId, { status: status as "draft" | "published" });
      await loadData();
    } catch {
      setError("error.server_error");
    }
  }

  async function handleDocumentStatusChange(documentId: string, status: string) {
    try {
      await api.adminUpdateKnowledgeDocument(documentId, { status: status as "draft" | "published" });
      await loadData();
    } catch {
      setError("error.server_error");
    }
  }

  async function handleSaveCategory() {
    const values = await categoryForm.validateFields();
    const payload = {
      ...values,
      bankId: values.bankId || null,
    };
    try {
      if (editingCategory) {
        await api.adminUpdateKnowledgeCategory(editingCategory.id, payload);
      } else {
        await api.adminCreateKnowledgeCategory(payload);
      }
      setCategoryModalOpen(false);
      categoryForm.resetFields();
      await loadData();
    } catch {
      setError("error.server_error");
    }
  }

  async function handleSaveDocument() {
    const values = await documentForm.validateFields();
    try {
      if (editingDocument) {
        await api.adminUpdateKnowledgeDocument(editingDocument.id, values);
      } else {
        await api.adminCreateKnowledgeDocument(values);
      }
      setDocumentModalOpen(false);
      documentForm.resetFields();
      await loadData();
    } catch {
      setError("error.server_error");
    }
  }

  const categoryColumns = [
    { title: t("common.title"), dataIndex: "name", key: "name" },
    {
      title: t("common.level"),
      dataIndex: "bankId",
      key: "bankId",
      render: (value?: string | null) => value ? <Tag color="blue">{value.replace("hsk-level-", "HSK ")}</Tag> : <Tag>{t("admin.general")}</Tag>,
    },
    { title: t("knowledge.documents"), dataIndex: "documentCount", key: "documentCount" },
    {
      title: t("common.status"),
      key: "status",
      render: (_: unknown, record: AdminKnowledgeCategory) => (
        <Select
          size="small"
          value={record.status}
          style={{ width: 120 }}
          onChange={(value) => handleCategoryStatusChange(record.id, value)}
          options={[
            { value: "draft", label: t("paper.status_draft") },
            { value: "published", label: t("paper.status_published") },
          ]}
        />
      ),
    },
    {
      title: t("common.actions"),
      key: "actions",
      render: (_: unknown, record: AdminKnowledgeCategory) => (
        <Button size="small" onClick={() => openCategoryModal(record)}>{t("common.save")}</Button>
      ),
    },
  ];

  const documentColumns = [
    { title: t("common.title"), dataIndex: "title", key: "title" },
    { title: t("knowledge.categories"), dataIndex: "categoryName", key: "categoryName" },
    {
      title: t("admin.tags"),
      dataIndex: "tags",
      key: "tags",
      render: (values?: string[]) => <Space wrap>{(values ?? []).map((tag) => <Tag key={tag}>{tag}</Tag>)}</Space>,
    },
    {
      title: t("common.status"),
      key: "status",
      render: (_: unknown, record: AdminKnowledgeDocument) => (
        <Select
          size="small"
          value={record.status}
          style={{ width: 120 }}
          onChange={(value) => handleDocumentStatusChange(record.id, value)}
          options={[
            { value: "draft", label: t("paper.status_draft") },
            { value: "published", label: t("paper.status_published") },
          ]}
        />
      ),
    },
    {
      title: t("common.actions"),
      key: "actions",
      render: (_: unknown, record: AdminKnowledgeDocument) => (
        <Button size="small" onClick={() => openDocumentModal(record)}>{t("common.save")}</Button>
      ),
    },
  ];

  return (
    <div className="admin-page" style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>{t("admin.knowledge")}</Typography.Title>
        <Space>
          <Button onClick={() => openCategoryModal()}>{t("admin.create_category")}</Button>
          <Button type="primary" onClick={() => openDocumentModal()}>{t("admin.create_document")}</Button>
        </Space>
      </div>
      <Card>
        {error && <Alert type="error" showIcon message={t(error)} style={{ marginBottom: 16 }} />}
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "categories",
              label: t("knowledge.categories"),
              children: (
                <Table
                  dataSource={categories}
                  columns={categoryColumns}
                  rowKey="id"
                  loading={loading}
                  size="small"
                  pagination={{ pageSize: 20 }}
                />
              ),
            },
            {
              key: "documents",
              label: t("knowledge.documents"),
              children: (
                <Table
                  dataSource={documents}
                  columns={documentColumns}
                  rowKey="id"
                  loading={loading}
                  size="small"
                  pagination={{ pageSize: 20 }}
                />
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={editingCategory ? t("admin.edit_category") : t("admin.create_category")}
        open={categoryModalOpen}
        onOk={handleSaveCategory}
        onCancel={() => setCategoryModalOpen(false)}
      >
        <Form form={categoryForm} layout="vertical">
          <Form.Item name="name" label={t("common.title")} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="bankId" label={t("common.level")}>
            <Select
              allowClear
              options={[1, 2, 3, 4, 5, 6].map((level) => ({
                value: `hsk-level-${level}`,
                label: `HSK ${level}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="description" label={t("admin.description")}>
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="displayOrder" label={t("admin.display_order")} initialValue={1}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="status" label={t("common.status")} initialValue="published">
            <Select options={[
              { value: "draft", label: t("paper.status_draft") },
              { value: "published", label: t("paper.status_published") },
            ]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingDocument ? t("admin.edit_document") : t("admin.create_document")}
        open={documentModalOpen}
        onOk={handleSaveDocument}
        onCancel={() => setDocumentModalOpen(false)}
        width={720}
      >
        <Form form={documentForm} layout="vertical">
          <Form.Item name="title" label={t("common.title")} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="categoryId" label={t("knowledge.categories")} rules={[{ required: true }]}>
            <Select options={categories.map((category) => ({ value: category.id, label: category.name }))} />
          </Form.Item>
          <Form.Item name="tags" label={t("admin.tags")}>
            <Select mode="tags" open={false} />
          </Form.Item>
          <Form.Item name="displayOrder" label={t("admin.display_order")} initialValue={1}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="status" label={t("common.status")} initialValue="draft">
            <Select options={[
              { value: "draft", label: t("paper.status_draft") },
              { value: "published", label: t("paper.status_published") },
            ]} />
          </Form.Item>
          <Form.Item name="content" label={t("knowledge.content")} rules={[{ required: true }]}>
            <Input.TextArea rows={12} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
