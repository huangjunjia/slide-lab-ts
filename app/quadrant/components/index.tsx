'use client';
import React, { useState, useEffect, useRef } from 'react';
import { DraggableCore, DraggableData, DraggableEvent } from 'react-draggable';
import * as ContextMenu from '@radix-ui/react-context-menu';
import * as Dialog from '@radix-ui/react-dialog';
import {
  saveProjects,
  loadProjects,
  createProject,
  getDefaultLabels,
  updateLabel,
  addLabel,
  deleteLabel,
  initLabels,
  getCategoryColors,
  updateCategoryColor,
  updateLabelActive,
  getQuadrants,
  updateQuadrant,
  getCategoryTextColors,
  updateCategoryTextColor,
  getPageBackgroundColor,
  Label,
  Project,
  QuadrantsSetting as TQuadrantsSetting, QuadrantItem,
} from '../utils/projectManager';
import { Icon } from '@iconify/react';
import { DraggableDialog } from './DraggableDialog';
import QuadrantSettings from './QuadrantSettings';
import { Button, Input, ColorPicker, Space, Modal } from 'antd';
import { ConfigProvider } from 'antd';
import { AggregationColor } from 'antd/es/color-picker/color';

const LabelEditor = ({ label, onSave, onClose, setCategoryColors }: {
  label: Label;
  onSave: (label: Label) => void;
  onClose: () => void;
  setCategoryColors: (categoryColors: Record<string, Label['color']>) => void;
}) => {
  const [localLabel, setLocalLabel] = useState({
    name: label.name,
    category: label.category,
    type: label.type,
  });
  const [localColor, setLocalColor] = useState(
    getCategoryColors()[label.category] || 'rgba(0,0,0,1)',
  );
  const [localTextColor, setLocalTextColor] = useState(
    getCategoryTextColors()[label.category] || '#ffffff',
  );

  const _setLocalColor = (color: AggregationColor) => {
    setLocalColor(color.toRgbString());
    setCategoryColors({
      ...getCategoryColors(),
      [label.category]: color.toRgbString(),
    });
  };

  const _setLocalTextColor = (color: AggregationColor) => {
    setLocalTextColor(color.toRgbString());
  };

  const handleSave = () => {
    if (localLabel.name.trim()) {
      onSave({
        ...localLabel,
        color: localColor,
        textColor: localTextColor,
      });
    }
  };

  const handleCancel = () => {
    setCategoryColors(getCategoryColors());
    onClose();
  };

  return (
    <DraggableDialog title="编辑分类" onClose={handleCancel}>
      <div className="w-[320px] space-y-4">
        <div>
          <div className="mb-2 text-sm text-gray-600">分类名称</div>
          <Input
            value={localLabel.name}
            onChange={e =>
              setLocalLabel(prev => ({ ...prev, name: e.target.value }))
            }
          />
        </div>

        <div>
          <div className="mb-2 text-sm text-gray-600">项目背景颜色</div>
          <ColorPicker value={localColor} onChange={(color) => _setLocalColor(color)} showText/>
        </div>

        <div>
          <div className="mb-2 text-sm text-gray-600">项目文字颜色</div>
          <ColorPicker
            value={localTextColor}
            onChange={_setLocalTextColor}
            showText
          />
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button onClick={handleCancel}>取消</Button>
          <Button type="primary" onClick={handleSave}>
            确定
          </Button>
        </div>
      </div>
    </DraggableDialog>
  );
};

const Quadrant = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [showInput, setShowInput] = useState(false);
  const [labels, setLabels] = useState(getDefaultLabels());
  const [editingLabel, setEditingLabel] = useState<Label & { index: number } | null>(null);
  const inputRef = useRef(null);
  const [categoryColors, setCategoryColors] = useState(getCategoryColors());
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [quadrants, setQuadrants] = useState(getQuadrants());
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const [isQuadrantCentered, setIsQuadrantCentered] = useState(false);
  const [pageBackgroundColor, setPageBackgroundColor] = useState(getPageBackgroundColor());
  const [showSettings, setShowSettings] = useState(false);
  const [axisLabels, setAxisLabels] = useState<Record<string, string>>({
    verticalStart: '不重要',
    verticalEnd: '重要',
    horizontalStart: '不紧急',
    horizontalEnd: '紧急',
  });
  const [axisColors, setAxisColors] = useState<Record<string, string>>({
    start: '#2d3efa50', // 对应 tailwind 的 axis-start
    end: '#2d3efaff', // 对应 tailwind 的 axis-end
  });
  const [applyAxisColorToText, setApplyAxisColorToText] = useState(true);
  const [dashedLineColor, setDashedLineColor] = useState('#2d3efa50'); // 默认虚线颜色
  const projectRefs = useRef<Record<string, React.RefObject<HTMLDivElement> | undefined>>({}); // 添加这行来存储每个项目的 ref

  // 添加一个 ref 来存储 RAF 的 ID
  const rafRef = useRef<number | null>(null);
  // 添加一个 ref 来存储最新的拖动数据
  const dragDataRef = useRef<{ id: string; e: DraggableEvent; data: DraggableData } | null>(null);

  useEffect(() => {
    initLabels();
    const savedProjects = loadProjects();
    setProjects(savedProjects);
    setLabels(getDefaultLabels());
    setCategoryColors(getCategoryColors());

    // 添加 ESC 键监听
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowInput(false);
        setEditingLabel(null);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  useEffect(() => {
    const savedMode = localStorage.getItem('quadrantMode');
    if (savedMode !== null) {
      setIsQuadrantCentered(JSON.parse(savedMode));
    }
  }, []);

  useEffect(() => {
    const savedLabels = localStorage.getItem('axisLabels');
    if (savedLabels) {
      setAxisLabels(JSON.parse(savedLabels));
    }

    const savedColors = localStorage.getItem('axisColors');
    if (savedColors) {
      const colors = JSON.parse(savedColors);
      setAxisColors(colors);
      document.documentElement.style.setProperty(
        '--axis-start-color',
        colors.start,
      );
      document.documentElement.style.setProperty(
        '--axis-end-color',
        colors.end,
      );
    }

    const savedColorToText = localStorage.getItem('applyAxisColorToText');
    if (savedColorToText !== null) {
      setApplyAxisColorToText(JSON.parse(savedColorToText));
    }
  }, []);

  useEffect(() => {
    const savedDashedLineColor = localStorage.getItem('dashedLineColor');
    if (savedDashedLineColor) {
      setDashedLineColor(savedDashedLineColor);
      document.documentElement.style.setProperty(
        '--dashed-line-color',
        savedDashedLineColor,
      );
    }
  }, []);

  // 在组件初始化时创建节流函数
  useEffect(() => {
    // 创建 RAF 更新函数
    const updatePosition = () => {
      if (!dragDataRef.current) {
        return;
      }

      const { id, e, data } = dragDataRef.current;
      const containerRect = document
        .querySelector('.quadrant-container')
        ?.getBoundingClientRect();

      if (!containerRect || !e) {
        return;
      }

      const padding = 0;

      const mouseX = data.lastX - (containerRect.left + padding);
      const mouseY = data.lastY - (containerRect.top + padding);

      const newX = mouseX - dragOffsetRef.current.x;
      const newY = mouseY - dragOffsetRef.current.y;

      const x = ((newX / containerRect.width) * 100).toFixed(2) + '%';
      const y = ((newY / containerRect.height) * 100).toFixed(2) + '%';

      setProjects(currentProjects => {
        const updatedProjects = currentProjects.map(project =>
          project.id === id ? { ...project, x, y } : project,
        );
        return updatedProjects;
      });

      // 清除当前拖动数据
      dragDataRef.current = null;
    };

    // 创建 RAF 循环函数
    const rafLoop = () => {
      updatePosition();
      rafRef.current = requestAnimationFrame(rafLoop);
    };

    // 启动 RAF 循环
    rafRef.current = requestAnimationFrame(rafLoop);

    // 清理函数
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const getCategoryColor = (category: string) => {
    const color = categoryColors[category];
    return color;
  };

  // 处理标签点击切换显示状态
  const handleLabelToggle = (e: React.MouseEvent, index: number) => {
    e.stopPropagation(); // 防止触发新项目
    const newLabels = [...labels];
    newLabels[index] = {
      ...newLabels[index],
      active: !newLabels[index].active,
    };
    setLabels(newLabels);
    updateLabelActive(index, newLabels[index].active);
  };

  // 添加新项目
  const handleAddProject = (name: string) => {
    if (!name.trim()) return;

    const newProject = createProject(name, '');
    const updatedProjects = [...projects, newProject];
    setProjects(updatedProjects);
    saveProjects(updatedProjects);
    setShowInput(false);
  };

  // 修改拖动相关的函数
  const handleDragStart = (e: DraggableEvent, data: DraggableData) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const containerRect = document
      .querySelector('.quadrant-container')
      ?.getBoundingClientRect();

    if (!containerRect) {
      return;
    }

    const mouseX = data.lastX - containerRect.left;
    const mouseY = data.lastY - containerRect.top;

    const elementCenterX = rect.left - containerRect.left + rect.width / 2;
    const elementCenterY = rect.top - containerRect.top + rect.height / 2;

    dragOffsetRef.current = {
      x: mouseX - elementCenterX,
      y: mouseY - elementCenterY,
    };
  };

  // 修改 handleDrag 函数，使用 RAF
  const handleDrag = (id: string, e: DraggableEvent, data: DraggableData) => {
    // 更新最新的拖动数据
    dragDataRef.current = { id, e, data };
  };

  const handleDragEnd = () => {
    setProjects(currentProjects => {
      saveProjects(currentProjects);
      return currentProjects;
    });
  };

  // 修改项目
  const handleDoubleClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setEditingProject(project);
  };

  const handleContextMenu = (e: React.MouseEvent, project: Project) => {
    e.preventDefault();
    Modal.confirm({
      title: '删除确认',
      content: `确定要删除 ${project.name} 吗？`,
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        const updatedProjects = projects.filter(p => p.id !== project.id);
        setProjects(updatedProjects);
        saveProjects(updatedProjects);
      },
    });
  };

  // 修改 handleProjectUpdate 函数
  const handleProjectUpdate = (id: string, newName: string, phase: Project['phase']) => {
    if (!newName.trim()) return;

    const updatedProjects = projects.map(project =>
      project.id === id ? { ...project, name: newName.trim(), phase } : project,
    );
    setProjects(updatedProjects);
    saveProjects(updatedProjects);
    setEditingProject(null);
  };

  const handleLabelSave = (updatedLabel: Label) => {
    if (editingLabel) {
      updateLabel(editingLabel.index, {
        ...updatedLabel,
        type: 'label',
      });
      updateCategoryColor(updatedLabel.category, updatedLabel.color);
      updateCategoryTextColor(updatedLabel.category, updatedLabel.textColor);
      setLabels(getDefaultLabels());
      setCategoryColors(getCategoryColors());
      setEditingLabel(null);
    }
  };

  const handleLabelContextMenu = (label: Label, index: number) => (
    <ContextMenu.Root key={index}>
      <ContextMenu.Trigger>
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={e => handleLabelToggle(e, index)}
        >
          <span
            className={`w-4 h-4 rounded-full transition-opacity duration-300 ease-in-out`}
            style={{
              backgroundColor: getCategoryColor(label.category) || undefined,
              opacity: label.active ? 1 : 0.3,
            }}
          ></span>
          <span
            className={`text-gray-600 font-medium text-sm transition-opacity duration-300 ease-in-out ${
              label.active ? 'opacity-100' : 'opacity-30'
            }`}
          >
            {label.name}
          </span>
        </div>
      </ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Content className="min-w-[160px] bg-white rounded-lg shadow-lg p-1 z-50">
          <ContextMenu.Item
            className="px-2 py-1 text-sm cursor-pointer text-gray-800 hover:bg-gray-100 rounded"
            onClick={() => {
              const confirm = Modal.confirm({
                title: '新增项目',
                icon: null,
                content: (
                  <Input
                    id="project-name"
                    placeholder="请输入项目名称"
                    onChange={e => {
                      confirm.update(prevConfig => ({
                        ...prevConfig,
                        okButtonProps: {
                          disabled: !e.target.value.trim(),
                        },
                      }));
                    }}
                  />
                ),
                okText: '确定',
                cancelText: '取消',
                onOk: () => {
                  const name = document.querySelector<HTMLInputElement>('#project-name')?.value;
                  if (name?.trim()) {
                    const newProject = createProject(name, label.category);
                    const updatedProjects = [...projects, newProject];
                    setProjects(updatedProjects);
                    saveProjects(updatedProjects);
                  }
                },
              });

            }}
          >
            新增项目
          </ContextMenu.Item>
          <ContextMenu.Separator className="h-[1px] bg-gray-200 my-1"/>
          <ContextMenu.Item
            className="px-2 py-1 text-sm cursor-pointer text-gray-800 hover:bg-gray-100 rounded"
            onClick={() => setEditingLabel({ ...label, index })}
          >
            编辑分类
          </ContextMenu.Item>
          <ContextMenu.Item
            className="px-2 py-1 text-sm cursor-pointer text-gray-800 hover:bg-gray-100 rounded"
            onClick={() => {
              const confirm = Modal.confirm({
                title: '添加新分类',
                icon: null,
                content: (
                  <Input
                    id="category-name"
                    autoFocus
                    placeholder="请输入新分类名称"
                    onChange={e => {
                      confirm.update(prevConfig => ({
                        ...prevConfig,
                        okButtonProps: {
                          disabled: !e.target.value.trim(),
                        },
                      }));
                    }}
                  />
                ),
                okText: '确定',
                cancelText: '取消',
                onOk: () => {
                  const name = document.querySelector<HTMLInputElement>('#category-name')?.value;
                  if (name?.trim()) {
                    addLabel({
                      name,
                      category: name,
                      type: 'label',
                    });
                    setLabels(getDefaultLabels());
                    setCategoryColors(getCategoryColors());
                  }
                },
              });
            }}
          >
            添加新分类
          </ContextMenu.Item>
          <ContextMenu.Item
            className="px-2 py-1 text-sm cursor-pointer hover:bg-gray-100 rounded text-red-500"
            onClick={() => {
              Modal.confirm({
                title: '删除确认',
                content: '确定要删除此分类吗？分类下所有项目也会同步删除',
                okText: '确定',
                cancelText: '取消',
                onOk: () => {
                  deleteLabel(index);
                  setLabels(getDefaultLabels());
                  setCategoryColors(getCategoryColors());
                },
              });
            }}
          >
            删除分类
          </ContextMenu.Item>
        </ContextMenu.Content>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );

  // 添加 QuadrantEditor 组件
  const QuadrantEditor = ({ position, quadrant, onSave, onClose }: {
    position: keyof TQuadrantsSetting;
    quadrant: QuadrantItem;
    onSave: (position: keyof TQuadrantsSetting, quadrant: QuadrantItem) => void;
    onClose: () => void;
  }) => {
    const [localQuadrant, setLocalQuadrant] = useState({
      name: quadrant.name,
      titleColor: quadrant.titleColor,
      backgroundColor: quadrant.backgroundColor,
    });

    const handleSave = () => {
      if (localQuadrant.name.trim()) {
        onSave(position, localQuadrant);
      }
    };

    return (
      <DraggableDialog title="编辑象限" onClose={onClose}>
        <div className="w-[320px] space-y-4">
          <div>
            <div className="mb-2 text-sm text-gray-600">象限名称</div>
            <Input
              value={localQuadrant.name}
              onChange={e =>
                setLocalQuadrant(prev => ({ ...prev, name: e.target.value }))
              }
            />
          </div>

          <div>
            <div className="mb-2 text-sm text-gray-600">标题颜色</div>
            <ColorPicker
              value={localQuadrant.titleColor}
              onChange={color =>
                setLocalQuadrant(prev => ({
                  ...prev,
                  titleColor: color.toRgbString(),
                }))
              }
              showText
            />
          </div>

          <div>
            <div className="mb-2 text-sm text-gray-600">背景颜色</div>
            <ColorPicker
              value={localQuadrant.backgroundColor}
              onChange={color =>
                setLocalQuadrant(prev => ({
                  ...prev,
                  backgroundColor: color.toRgbString(),
                }))
              }
              showText
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button onClick={onClose}>取消</Button>
            <Button type="primary" onClick={handleSave}>
              确定
            </Button>
          </div>
        </div>
      </DraggableDialog>
    );
  };

  // 修改 QuadrantBox 组件
  const QuadrantBox = ({ position }: { position: keyof TQuadrantsSetting }) => {
    const [showEditDialog, setShowEditDialog] = useState(false);

    const handleQuadrantSave = (position: keyof TQuadrantsSetting, updatedQuadrant: QuadrantItem) => {
      const newQuadrants = updateQuadrant(position, updatedQuadrant);
      setQuadrants(newQuadrants);
      setShowEditDialog(false);
    };

    return (
      <div className="relative w-full h-full group">
        <div
          className="w-full h-full"
          style={{
            backgroundColor: quadrants[position].backgroundColor,
          }}
        >
          <span
            className="absolute inset-0 flex items-center justify-center text-[72px] font-bold select-none"
            style={{ color: quadrants[position].titleColor }}
          >
            {quadrants[position].name}
          </span>
        </div>

        <button
          className="absolute bottom-2 right-2
            w-8 h-8
            flex items-center justify-center
            bg-white/80 hover:bg-white
            rounded-lg
            text-gray-500 hover:text-gray-700
            shadow-lg hover:shadow-xl
            transition-all duration-300 ease-in-out
            opacity-0 group-hover:opacity-100
            transform hover:scale-105
            z-20"
          onClick={() => setShowEditDialog(true)}
        >
          <Icon icon="solar:pen-2-linear" width="18" height="18"/>
        </button>

        <Dialog.Root open={showEditDialog} onOpenChange={setShowEditDialog}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40"/>
            {showEditDialog && (
              <QuadrantEditor
                position={position}
                quadrant={quadrants[position]}
                onSave={handleQuadrantSave}
                onClose={() => setShowEditDialog(false)}
              />
            )}
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    );
  };

  const axisClassNames = isQuadrantCentered
    ? {
      axisLabelHorizontalStart:
        'absolute -left-8 top-1/2 -translate-y-1/2 writing-vertical-lr transform rotate-0',
      axisLabelHorizontalEnd:
        'absolute -right-8 top-1/2 -translate-y-1/2 writing-vertical-lr',
      axisLabelVerticalStart: 'absolute -bottom-8 left-1/2 -translate-x-1/2',
      axisLabelVerticalEnd: 'absolute -top-8 left-1/2 -translate-x-1/2',
      axisLegend:
        'flex justify-center items-center gap-12 mt-0 absolute -bottom-8 right-0 bg-transparent select-none',
      axisLineArrowToTop: `-top-[1px] left-[50%]`,
      axisLineArrowToRight: `-right-[1px] top-[50%] -translate-y-1/2`,
      axisLineToTop: 'left-[50%]',
      axisLineToRight: 'bottom-[50%]',
    }
    : {
      axisLabelHorizontalStart:
        'absolute left-8 -bottom-8 transform rotate-0',
      axisLabelHorizontalEnd: 'absolute right-8 -bottom-8',
      axisLabelVerticalStart: 'absolute writing-vertical-lr bottom-8 -left-8',
      axisLabelVerticalEnd: 'absolute writing-vertical-lr top-8 -left-8',
      axisLegend:
        'flex justify-center items-center gap-12 mt-0 absolute -bottom-8 left-1/2 -translate-x-1/2 bg-transparent select-none',
      axisLineArrowToTop: `-top-[1px] left-[1px]`,
      axisLineArrowToRight: `-right-[1px] bottom-[1px] translate-y-1/2`,
      axisLineToTop: 'left-0',
      axisLineToRight: 'bottom-0',
    };

  // 添加一个可复用的项目预览组件
  const ProjectPreview = ({ project, name, isPreview = false, phase }: {
    project: Project,
    name: string;
    isPreview?: boolean;
    phase: Project['phase'];
  }) => {
    const textColor = getCategoryTextColors()[project.category] || '#ffffff';

    return (
      <div
        className={`relative flex items-center whitespace-pre-line text-center shadow-lg select-none rounded-full text-sm ${
          isPreview ? '' : 'hover:scale-105 cursor-move'
        }`}
        style={{
          backgroundColor: getCategoryColor(project.category) || undefined,
          color: textColor,
          minWidth: 'max-content',
          maxWidth: '300px',
        }}
      >
        {phase && phase?.text && (
          <>
            <div
              className="absolute left-full top-0 -translate-y-1/3 -translate-x-5
              min-w-7 px-1 h-7 rounded-full flex items-center justify-center text-xs font-medium
              border-2 border-white/50"
              style={{
                backgroundColor:
                  phase.color || getCategoryColor(project.category) || undefined,
                color: phase.textColor || textColor,
              }}
            >
              {phase.text}
            </div>
          </>
        )}
        <span className={`block py-2 px-4`}>{name || project.name}</span>
      </div>
    );
  };

  // 修改项目编辑对话框
  const ProjectEditDialog = ({ project }: { project: Project }) => {
    const [name, setName] = useState(project.name);
    const [phase, setPhase] = useState(
      project.phase || { text: '', color: '', textColor: project.textColor },
    );

    const handleSave = () => {
      const updatedProjects = projects.map(p =>
        p.id === project.id ? { ...p, name, phase } : p,
      );

      setProjects(updatedProjects);
      saveProjects(updatedProjects);
      handleProjectUpdate(project.id, name, phase);
    };

    const applyPhaseToAllProjects = () => {
      const updatedProjects = projects.map(p => ({ ...p, phase }));
      setProjects(updatedProjects);
      saveProjects(updatedProjects);
      setEditingProject(prev => {
        if (!prev) {
          return prev;
        }
        return { ...prev, phase }
      });
    };

    const applyPhaseToSamePhaseProjects = () => {
      const updatedProjects = projects.map(p =>
        p.phase?.text === project.phase?.text ? { ...p, phase } : p,
      );
      setProjects(updatedProjects);
      saveProjects(updatedProjects);
      setEditingProject(prev => {
        if (!prev) {
          return prev;
        }
        return { ...prev, phase }
      });
    };

    const clearColor = (key: string) => {
      setPhase(prev => ({ ...prev, [key]: '' }));
    };

    return (
      <DraggableDialog title="编辑项目" onClose={() => setEditingProject(null)}>
        <div className="w-[500px] space-y-6">
          {/* 阶段标记设置 */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">阶段标记</div>
            <Space align="start">
              <Input
                value={phase.text || ''}
                onChange={e =>
                  setPhase(prev => ({ ...prev, text: e.target.value }))
                }
                className="w-20 text-center"
                placeholder=""
                maxLength={4}
              />
              <Space direction="vertical" size="small">
                <Space>
                  <span className="text-xs text-gray-500">背景色</span>
                  <ColorPicker
                    value={phase.color || getCategoryColor(project.category)}
                    onChange={color =>
                      setPhase(prev => ({
                        ...prev,
                        color: color.toHexString(),
                      }))
                    }
                  />
                  <Button
                    type="text"
                    size="small"
                    onClick={() => clearColor('color')}
                    className="text-xs text-gray-500"
                  >
                    清除
                  </Button>
                </Space>
                <Space>
                  <span className="text-xs text-gray-500">文字色</span>
                  <ColorPicker
                    value={phase.textColor || '#ffffff'}
                    onChange={color =>
                      setPhase(prev => ({
                        ...prev,
                        textColor: color.toHexString(),
                      }))
                    }
                  />
                  <Button
                    type="text"
                    size="small"
                    onClick={() => clearColor('textColor')}
                    className="text-xs text-gray-500"
                  >
                    清除
                  </Button>
                </Space>
              </Space>
            </Space>
            <Space className="mt-2">
              <Button
                onClick={applyPhaseToSamePhaseProjects}
                type="primary"
                danger
              >
                同步到相同阶段
              </Button>
              <Button onClick={applyPhaseToAllProjects} type="primary">
                设置到所有项目（含阶段名称）
              </Button>
            </Space>
          </div>

          {/* 项目名称 */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">项目名称</div>
            <Input.TextArea
              value={name}
              onChange={e => setName(e.target.value)}
              rows={3}
            />
          </div>

          {/* 效果预览 */}
          <div className="space-y-2">
            <div className="text-sm font-medium text-gray-700">效果预览</div>
            <div className="relative w-full h-24 bg-gray-50 rounded-lg border flex items-center justify-center">
              <ProjectPreview
                project={project}
                name={name}
                phase={phase}
                isPreview={true}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button onClick={() => setEditingProject(null)}>取消</Button>
            <Button type="primary" onClick={handleSave}>
              保存
            </Button>
          </div>
        </div>
      </DraggableDialog>
    );
  };

  return (
    <ConfigProvider getPopupContainer={node => node?.parentElement || document.body}>
      <div className="w-[100dvw] h-[100dvh]">
        <button
          onClick={() => setShowSettings(true)}
          className="absolute top-2 right-2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Icon
            icon="solar:settings-linear"
            width="24"
            height="24"
            className="text-gray-600"
          />
        </button>

        <Dialog.Root open={showSettings} onOpenChange={setShowSettings}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40"/>
            <QuadrantSettings
              open={showSettings}
              onClose={() => setShowSettings(false)}
              initialSettings={{
                isQuadrantCentered,
                dashedLineColor,
                axisLabels,
                axisColors,
                applyAxisColorToText,
                pageBackgroundColor,
              }}
              onSave={settings => {
                // 一次性更新所有设置
                setIsQuadrantCentered(settings.isQuadrantCentered);
                localStorage.setItem(
                  'quadrantMode',
                  JSON.stringify(settings.isQuadrantCentered),
                );

                setDashedLineColor(settings.dashedLineColor);
                localStorage.setItem(
                  'dashedLineColor',
                  settings.dashedLineColor,
                );
                document.documentElement.style.setProperty(
                  '--dashed-line-color',
                  settings.dashedLineColor,
                );

                setAxisLabels(settings.axisLabels);
                localStorage.setItem(
                  'axisLabels',
                  JSON.stringify(settings.axisLabels),
                );

                setAxisColors(settings.axisColors);
                localStorage.setItem(
                  'axisColors',
                  JSON.stringify(settings.axisColors),
                );
                document.documentElement.style.setProperty(
                  '--axis-start-color',
                  settings.axisColors.start,
                );
                document.documentElement.style.setProperty(
                  '--axis-end-color',
                  settings.axisColors.end,
                );

                setApplyAxisColorToText(settings.applyAxisColorToText);
                localStorage.setItem(
                  'applyAxisColorToText',
                  settings.applyAxisColorToText + '',
                );

                setPageBackgroundColor(settings.pageBackgroundColor);
              }}
            />
          </Dialog.Portal>
        </Dialog.Root>

        <div className="relative w-full px-12 my-12 fullscreen-bg" onClick={() => setShowInput(false)}>
          <div
            className={`text-base font-medium ${
              applyAxisColorToText
                ? 'text-[var(--axis-end-color)]'
                : 'text-gray-600'
            } ${axisClassNames.axisLabelVerticalEnd}`}
          >
            {axisLabels.verticalEnd}
          </div>
          <div
            className={`text-base font-medium ${
              applyAxisColorToText
                ? 'text-[var(--axis-start-color)]'
                : 'text-gray-600'
            } ${axisClassNames.axisLabelVerticalStart}`}
          >
            {axisLabels.verticalStart}
          </div>
          <div
            className={`text-base font-medium ${
              applyAxisColorToText
                ? 'text-[var(--axis-start-color)]'
                : 'text-gray-600'
            } ${axisClassNames.axisLabelHorizontalStart}`}
          >
            {axisLabels.horizontalStart}
          </div>
          <div
            className={`text-base font-medium ${
              applyAxisColorToText
                ? 'text-[var(--axis-end-color)]'
                : 'text-gray-600'
            } ${axisClassNames.axisLabelHorizontalEnd}`}
          >
            {axisLabels.horizontalEnd}
          </div>

          {/* 主要内容区域 */}
          <div className="relative w-full min-h-[80dvh] bg-white shadow-lg p-8 mx-auto">
            {/* 四个象限背景 */}
            <div className="absolute quadrant-container inset-0 grid grid-cols-2 grid-rows-2">
              <QuadrantBox position="topLeft"/>
              <QuadrantBox position="topRight"/>
              <QuadrantBox position="bottomLeft"/>
              <QuadrantBox position="bottomRight"/>
            </div>

            {/* 背景格 */}
            <div className="absolute inset-0 bg-grid opacity-20 pointer-events-none"></div>

            {/* 坐标轴 - 使用渐变色 */}
            <div
              className={`absolute top-0 bottom-0 w-[1px] z-20 ${axisClassNames.axisLineToTop}`}
            >
              <div
                className="absolute bottom-0 h-[100%] w-full bg-axis-gradient-to-top from-axis-start to-axis-end"></div>
            </div>
            <div
              className={`absolute left-0 right-0 h-[1px] z-20 ${axisClassNames.axisLineToRight}`}
            >
              <div
                className="absolute left-0 w-full h-full bg-axis-gradient-to-right from-axis-start to-axis-end"></div>
            </div>

            {/* 虚线分割线 */}
            {!isQuadrantCentered && (
              <>
                <div
                  className="absolute left-0 right-0 h-[1px] z-10"
                  style={{
                    top: '50%',
                    borderTop: `1px dashed var(--dashed-line-color)`,
                  }}
                ></div>
                <div
                  className="absolute top-0 bottom-0 w-[1px] h-full z-10"
                  style={{
                    left: '50%',
                    borderLeft: `1px dashed var(--dashed-line-color)`,
                  }}
                ></div>
              </>
            )}

            {/* 坐标轴箭头 */}
            <div
              className={`absolute ${axisClassNames.axisLineArrowToTop} -translate-x-1/2 w-0 h-0 
            border-l-[6px] border-l-transparent 
            border-r-[6px] border-r-transparent 
            border-b-[8px] z-10`}
              style={{ borderBottomColor: 'var(--axis-end-color)' }}
            ></div>
            <div
              className={`absolute ${axisClassNames.axisLineArrowToRight} w-0 h-0 
            border-t-[6px] border-t-transparent 
            border-b-[6px] border-b-transparent 
            border-l-[8px] z-10`}
              style={{ borderLeftColor: 'var(--axis-end-color)' }}
            ></div>

            {/* 项目点 - 添加过滤和动画 */}
            {projects.map(project => {
              // 确保每个项目都有一个 ref
              if (!projectRefs.current[project.id]) {
                projectRefs.current[project.id] = React.createRef();
              }

              const isVisible = labels.find(
                label => label.category === project.category,
              )?.active;

              if (!isVisible) return null;

              return (
                <DraggableCore
                  key={project.id}
                  nodeRef={projectRefs.current[project.id]} // 添加 nodeRef
                  onStart={handleDragStart}
                  onDrag={(e, data) => handleDrag(project.id, e, data)}
                  onStop={() => handleDragEnd()}
                  scale={1}
                  grid={[1, 1]}
                  allowAnyClick={false}
                >
                  <div
                    ref={projectRefs.current[project.id]} // 添加 ref
                    style={{
                      left: project.x,
                      top: project.y,
                      transform: `translate(-50%, -50%)`,
                      touchAction: 'none',
                      width: 'auto',
                    }}
                    className={`absolute z-30 ${
                      isVisible ? 'transition-opacity' : 'transition-none'
                    }`}
                    onDoubleClick={e => handleDoubleClick(e, project)}
                    onContextMenu={e => handleContextMenu(e, project)}
                  >
                    <ProjectPreview
                      project={project}
                      name={project.name}
                      phase={project.phase}
                    />
                  </div>
                </DraggableCore>
              );
            })}
          </div>

          {/* 底部图例 */}
          <div className={axisClassNames.axisLegend}>
            {labels.map((label, index) => handleLabelContextMenu(label, index))}
          </div>
        </div>

        {/* 修改编辑标签对话框 */}
        <Dialog.Root
          open={!!editingLabel}
          onOpenChange={open => !open && setEditingLabel(null)}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40"/>
            {editingLabel && (
              <LabelEditor
                label={editingLabel}
                onSave={handleLabelSave}
                setCategoryColors={setCategoryColors}
                onClose={() => setEditingLabel(null)}
              />
            )}
          </Dialog.Portal>
        </Dialog.Root>

        {/* 修改输入框样式 */}
        {showInput && (
          <div
            className="absolute z-50 bg-white shadow-lg rounded-lg p-2 border border-gray-200"
            // style={{ left: inputPosition.x, top: inputPosition.y }}
            onClick={e => e.stopPropagation()}
          >
            <input
              ref={inputRef}
              type="text"
              className="border rounded px-2 py-1 text-sm text-gray-800 bg-white"
              placeholder="输入项目名称"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleAddProject(e.currentTarget.value);
                }
              }}
              onBlur={e => {
                if (e.target.value) {
                  handleAddProject(e.target.value);
                }
              }}
            />
          </div>
        )}

        {/* 修改编辑对话框的触发 */}
        <Dialog.Root
          open={!!editingProject}
          onOpenChange={open => !open && setEditingProject(null)}
        >
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/50 z-40"/>
            {editingProject && <ProjectEditDialog project={editingProject}/>}
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </ConfigProvider>
  );
};

export default Quadrant;
