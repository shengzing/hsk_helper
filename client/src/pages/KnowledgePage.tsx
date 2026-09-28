import { Alert, Card, Empty, Input, Skeleton, Tree, Typography } from "antd";
import type { DataNode } from "antd/es/tree";
import { SearchOutlined } from "@ant-design/icons";
import { useEffect, useMemo, useState } from "react";
import type { Key } from "react";
import { useTranslation } from "react-i18next";
import { api } from "../api";
import Markdown from "../components/Markdown";
import type { KnowledgeCategory, KnowledgeDocument } from "../types";

type KnowledgeTree = {
  categories: KnowledgeCategory[];
  documentsByCategory: Record<string, KnowledgeDocument[]>;
};

export default function KnowledgePage() {
  const { t } = useTranslation();
  const [tree, setTree] = useState<KnowledgeTree>({
    categories: [],
    documentsByCategory: {},
  });
  const [selectedDoc, setSelectedDoc] = useState<KnowledgeDocument | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { categories } = await api.getKnowledgeCategories();
        if (cancelled) return;
        if (categories.length === 0) {
          setError("error.server_error");
          return;
        }

        const entries = await Promise.all(
          categories.map(async (category) => {
            const { documents } = await api.getKnowledgeDocuments(category.id);
            return [category.id, documents] as const;
          })
        );
        if (cancelled) return;

        const documentsByCategory = Object.fromEntries(entries);
        setTree({ categories, documentsByCategory });
        setExpandedKeys(categories.map((category) => `category:${category.id}`));

        const firstDocument = documentsByCategory[categories[0].id]?.[0];
        if (firstDocument) {
          const { document } = await api.getKnowledgeDocument(firstDocument.id);
          if (cancelled) return;
          setSelectedDoc(document);
          setSelectedKeys([`document:${document.id}`]);
        }
      } catch {
        setError("error.server_error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!search.trim()) return;
    setExpandedKeys(tree.categories.map((category) => `category:${category.id}`));
  }, [search, tree.categories]);

  const treeData = useMemo<DataNode[]>(() => {
    const query = search.trim().toLowerCase();

    return tree.categories
      .filter((category) => {
        if (!query) return true;
        const categoryMatch = category.name.toLowerCase().includes(query);
        const documents = tree.documentsByCategory[category.id] ?? [];
        const documentMatch = documents.some((document) =>
          document.title.toLowerCase().includes(query)
        );
        return categoryMatch || documentMatch;
      })
      .map((category) => {
        const documents = tree.documentsByCategory[category.id] ?? [];
        const categoryMatch = category.name.toLowerCase().includes(query);
        const visibleDocuments =
          query && !categoryMatch
            ? documents.filter((document) =>
                document.title.toLowerCase().includes(query)
              )
            : documents;

        return {
          key: `category:${category.id}`,
          title: (
            <span className="knowledge-tree-title">
              <span>{category.name}</span>
              <span className="knowledge-tree-count">{category.documentCount}</span>
            </span>
          ),
          children: visibleDocuments.map((document) => ({
            key: `document:${document.id}`,
            title: document.title,
            isLeaf: true,
          })),
        };
      });
  }, [search, tree]);

  const handleTreeExpand = (keys: Key[]) => {
    setExpandedKeys(keys.map(String));
  };

  const handleTreeSelect = async (keys: Key[]) => {
    const key = keys[0] ? String(keys[0]) : "";
    if (!key.startsWith("document:")) return;

    const documentId = key.slice("document:".length);
    try {
      const { document } = await api.getKnowledgeDocument(documentId);
      setSelectedDoc(document);
      setSelectedKeys([key]);
      setError(null);
    } catch {
      setError("error.server_error");
    }
  };

  if (loading) {
    return (
      <div className="page-container">
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  return (
    <div className="page-container">
      <Typography.Title level={2}>{t("nav.knowledge")}</Typography.Title>
      {error && (
        <Alert type="error" showIcon message={t(error)} style={{ marginBottom: 16 }} />
      )}
      <div className="knowledge-layout">
        <Card title={t("knowledge.categories")} size="small" className="knowledge-tree-card">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("common.search")}
            size="small"
          />
          <div className="knowledge-tree-scroll">
            <Tree
              blockNode
              expandedKeys={expandedKeys}
              onExpand={handleTreeExpand}
              onSelect={(keys) => void handleTreeSelect(keys)}
              selectedKeys={selectedKeys}
              showLine
              treeData={treeData}
            />
          </div>
        </Card>

        <Card title={t("knowledge.content")} size="small" className="knowledge-content-card">
          {selectedDoc ? (
            <Markdown content={selectedDoc.content ?? ""} />
          ) : (
            <Empty description={t("common.empty")} />
          )}
        </Card>
      </div>
    </div>
  );
}
