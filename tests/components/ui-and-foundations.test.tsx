import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "vitest-axe";
import { renderWithProviders } from "../utils/render";

// UI Components under test
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Drawer } from "@/components/ui/Drawer";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Toast } from "@/components/ui/Toast";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ListItem } from "@/components/ui/ListItem";

describe("UI Foundations & Design System Primitives Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Button Component", () => {
    it("renders with default props and handles click events", async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      renderWithProviders(
        <Button onClick={handleClick}>Click Me</Button>
      );

      const button = screen.getByRole("button", { name: "Click Me" });
      expect(button).toBeInTheDocument();
      expect(button).toHaveClass("btn", "btn-primary");

      await user.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("renders different variants and sizes", () => {
      const { rerender } = renderWithProviders(
        <Button variant="danger" size="sm">Delete</Button>
      );
      let button = screen.getByRole("button", { name: "Delete" });
      expect(button).toHaveClass("btn-danger", "btn-sm");

      rerender(<Button variant="ghost" size="lg">Cancel</Button>);
      button = screen.getByRole("button", { name: "Cancel" });
      expect(button).toHaveClass("btn-ghost", "btn-lg");
    });

    it("respects disabled state and prevents click handler invocation", async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      renderWithProviders(
        <Button disabled onClick={handleClick}>Disabled Action</Button>
      );

      const button = screen.getByRole("button", { name: "Disabled Action" });
      expect(button).toBeDisabled();

      await user.click(button);
      expect(handleClick).not.toHaveBeenCalled();
    });

    it("renders loading spinner and sets disabled when loading", () => {
      renderWithProviders(
        <Button loading>Saving Changes</Button>
      );

      const button = screen.getByRole("button", { name: /Saving Changes/i });
      expect(button).toBeDisabled();
      expect(button.querySelector(".loading")).toBeInTheDocument();
    });

    it("renders as anchor tag when href is provided", () => {
      renderWithProviders(
        <Button href="/dashboard" target="_blank" rel="noopener noreferrer">
          Go to Dashboard
        </Button>
      );

      const link = screen.getByRole("link", { name: "Go to Dashboard" });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/dashboard");
      expect(link).toHaveAttribute("target", "_blank");
    });

    it("passes axe accessibility checks", async () => {
      const { container } = renderWithProviders(
        <Button variant="primary" aria-label="Confirm Action">Confirm</Button>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Input Component", () => {
    it("renders input field with associated label and handles user input", async () => {
      const user = userEvent.setup();
      const handleChange = vi.fn();

      renderWithProviders(
        <Input
          label="Full Name"
          placeholder="Enter your name"
          onChange={handleChange}
        />
      );

      const input = screen.getByLabelText("Full Name");
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute("placeholder", "Enter your name");

      await user.type(input, "Pooja Roy");
      expect(handleChange).toHaveBeenCalled();
      expect(input).toHaveValue("Pooja Roy");
    });

    it("renders error message and applies error styling", () => {
      renderWithProviders(
        <Input
          label="Email Address"
          error="Please enter a valid business email"
          defaultValue="invalid-email"
        />
      );

      expect(screen.getByText("Please enter a valid business email")).toBeInTheDocument();
      const input = screen.getByLabelText("Email Address");
      expect(input).toHaveClass("input-error");
    });

    it("renders rightElement slot when provided", () => {
      renderWithProviders(
        <Input
          label="Search"
          rightElement={<span data-testid="search-icon">🔍</span>}
        />
      );

      expect(screen.getByTestId("search-icon")).toBeInTheDocument();
    });

    it("passes axe accessibility checks", async () => {
      const { container } = renderWithProviders(
        <Input label="Workspace Name" id="ws-name" required />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Select Component", () => {
    const mockOptions = [
      { value: "INFLUENCER", label: "Influencer / Creator" },
      { value: "BRAND", label: "Brand / Agency" },
      { value: "SCOUT", label: "Talent Scout" },
    ];

    it("renders label and options correctly", () => {
      renderWithProviders(
        <Select
          label="User Role"
          options={mockOptions}
          defaultValue="INFLUENCER"
        />
      );

      expect(screen.getByText("User Role")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Influencer \/ Creator/i })).toBeInTheDocument();
    });

    it("renders error state when error message provided", () => {
      renderWithProviders(
        <Select
          label="User Role"
          options={mockOptions}
          error="Role selection is required"
        />
      );

      expect(screen.getByText("Role selection is required")).toBeInTheDocument();
    });

    it("passes axe accessibility checks", async () => {
      const { container } = renderWithProviders(
        <Select
          label="Category"
          id="select-category"
          options={mockOptions}
          defaultValue="BRAND"
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Modal Component", () => {
    it("renders modal dialog when open is true and traps focus", () => {
      const handleClose = vi.fn();
      renderWithProviders(
        <Modal open={true} onClose={handleClose} title="Escrow Agreement">
          <p>Review the escrow contract details.</p>
          <Button onClick={handleClose}>Acknowledge</Button>
        </Modal>
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Escrow Agreement")).toBeInTheDocument();
      expect(screen.getByText("Review the escrow contract details.")).toBeInTheDocument();
    });

    it("does not render when open is false", () => {
      renderWithProviders(
        <Modal open={false} onClose={vi.fn()} title="Hidden Modal">
          <p>Should not be visible</p>
        </Modal>
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("calls onClose when escape key is pressed", () => {
      const handleClose = vi.fn();
      renderWithProviders(
        <Modal open={true} onClose={handleClose} title="Keydown Test">
          <p>Content</p>
        </Modal>
      );

      fireEvent.keyDown(window, { key: "Escape" });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("passes axe accessibility checks", async () => {
      const { container } = renderWithProviders(
        <Modal open={true} onClose={vi.fn()} title="Accessible Dialog">
          <p>Accessible Modal Content</p>
        </Modal>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Drawer Component", () => {
    it("renders drawer with title and children when open", () => {
      const handleClose = vi.fn();
      renderWithProviders(
        <Drawer open={true} onClose={handleClose} title="Filter Deals">
          <p>Filter options go here.</p>
        </Drawer>
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Filter Deals")).toBeInTheDocument();
      expect(screen.getByText("Filter options go here.")).toBeInTheDocument();
    });

    it("triggers onClose when clicking close button", async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();

      renderWithProviders(
        <Drawer open={true} onClose={handleClose} title="Filter Drawer">
          <div>Content</div>
        </Drawer>
      );

      const closeBtn = screen.getByRole("button", { name: /^Close drawer$/i });
      await user.click(closeBtn);

      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("passes axe accessibility checks", async () => {
      const { container } = renderWithProviders(
        <Drawer open={true} onClose={vi.fn()} title="Accessible Drawer">
          <p>Drawer Body</p>
        </Drawer>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("BottomSheet Component", () => {
    it("renders adaptive bottom sheet when open", () => {
      const handleClose = vi.fn();
      renderWithProviders(
        <BottomSheet
          open={true}
          onClose={handleClose}
          title="Milestone Details"
          description="Review milestone deliverables"
        >
          <p>Milestone 1: 30s Reel</p>
        </BottomSheet>
      );

      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByText("Milestone Details")).toBeInTheDocument();
      expect(screen.getByText("Review milestone deliverables")).toBeInTheDocument();
      expect(screen.getByText("Milestone 1: 30s Reel")).toBeInTheDocument();
    });

    it("passes axe accessibility checks", async () => {
      const { container } = renderWithProviders(
        <BottomSheet open={true} onClose={vi.fn()} title="Payment Sheet">
          <p>Payment summary</p>
        </BottomSheet>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Toast Component", () => {
    it("renders toast with message and icon according to type", () => {
      const handleClose = vi.fn();
      renderWithProviders(
        <Toast
          toast={{ id: "t-1", type: "success", message: "Escrow funds released!" }}
          onClose={handleClose}
        />
      );

      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Escrow funds released!")).toBeInTheDocument();
    });

    it("calls onClose when dismiss button is clicked", async () => {
      const user = userEvent.setup();
      const handleClose = vi.fn();

      renderWithProviders(
        <Toast
          toast={{ id: "t-2", type: "error", message: "Payout failed" }}
          onClose={handleClose}
        />
      );

      const dismissBtn = screen.getByRole("button", { name: /Dismiss error notification/i });
      await user.click(dismissBtn);

      expect(handleClose).toHaveBeenCalledWith("t-2");
    });

    it("passes axe accessibility checks", async () => {
      const { container } = renderWithProviders(
        <Toast
          toast={{ id: "t-3", type: "info", message: "New collaboration proposal received" }}
          onClose={vi.fn()}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("ThemeToggle Component", () => {
    it("renders theme toggle buttons", () => {
      renderWithProviders(<ThemeToggle variant="segmented" />);

      expect(screen.getByRole("group", { name: /Select theme mode/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Light/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Dark/i })).toBeInTheDocument();
    });

    it("passes axe accessibility checks", async () => {
      const { container } = renderWithProviders(<ThemeToggle variant="segmented" />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("EmptyState Component", () => {
    it("renders title, description, and primary action button", async () => {
      const user = userEvent.setup();
      const handleAction = vi.fn();

      renderWithProviders(
        <EmptyState
          title="No Active Deals"
          description="You currently have no active escrow deals. Browse campaigns to start collaborating."
          actionLabel="Browse Campaigns"
          onActionClick={handleAction}
        />
      );

      expect(screen.getByText("No Active Deals")).toBeInTheDocument();
      expect(screen.getByText(/You currently have no active escrow deals/i)).toBeInTheDocument();

      const actionButton = screen.getByRole("button", { name: "Browse Campaigns" });
      await user.click(actionButton);
      expect(handleAction).toHaveBeenCalledTimes(1);
    });

    it("renders secondary action when provided", async () => {
      const user = userEvent.setup();
      const handleSecondary = vi.fn();

      renderWithProviders(
        <EmptyState
          title="No Messages"
          description="Your inbox is empty."
          actionLabel="Start Chat"
          onActionClick={vi.fn()}
          secondaryActionLabel="Refresh"
          onSecondaryActionClick={handleSecondary}
        />
      );

      const secondaryBtn = screen.getByRole("button", { name: "Refresh" });
      await user.click(secondaryBtn);
      expect(handleSecondary).toHaveBeenCalledTimes(1);
    });

    it("passes axe accessibility checks", async () => {
      const { container } = renderWithProviders(
        <EmptyState
          title="Empty Search"
          description="No creators matched your filters."
          actionLabel="Clear Filters"
          onActionClick={vi.fn()}
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Badge Component", () => {
    it("renders badge text with specified variant", () => {
      renderWithProviders(
        <Badge variant="success">Verified</Badge>
      );

      const badge = screen.getByText("Verified");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveClass("badge", "badge-success");
    });

    it("passes axe accessibility checks", async () => {
      const { container } = renderWithProviders(
        <Badge variant="warning">In Review</Badge>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("Card Component", () => {
    it("renders polymorphic container and children", () => {
      renderWithProviders(
        <Card as="article" gradient className="custom-card">
          <h2>Deal Summary</h2>
          <p>₹25,000 in escrow</p>
        </Card>
      );

      const heading = screen.getByText("Deal Summary");
      expect(heading).toBeInTheDocument();
      const article = heading.closest("article");
      expect(article).toBeInTheDocument();
      expect(article).toHaveClass("card", "card-gradient", "custom-card");
    });

    it("handles click handler when provided", async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();

      renderWithProviders(
        <Card onClick={handleClick}>
          <span>Interactive Card</span>
        </Card>
      );

      await user.click(screen.getByText("Interactive Card"));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it("passes axe accessibility checks", async () => {
      const { container } = renderWithProviders(
        <Card as="section" aria-label="Escrow Status">
          <h2>Active Milestone</h2>
          <p>Content approved</p>
        </Card>
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe("ListItem Component", () => {
    it("renders leading, title, subtitle, and trailing elements", () => {
      renderWithProviders(
        <ListItem
          leading={<span data-testid="avatar">Avatar</span>}
          title="Pooja Roy"
          subtitle="Submitted reel draft for review"
          trailing={<span>₹15,000</span>}
          unread={true}
        />
      );

      expect(screen.getByTestId("avatar")).toBeInTheDocument();
      expect(screen.getByText("Pooja Roy")).toBeInTheDocument();
      expect(screen.getByText("Submitted reel draft for review")).toBeInTheDocument();
      expect(screen.getByText("₹15,000")).toBeInTheDocument();
    });

    it("renders link when href is supplied", () => {
      renderWithProviders(
        <ListItem
          href="/dashboard/deals/deal-123"
          title="Campaign Deal #123"
          subtitle="Milestone 2"
        />
      );

      const link = screen.getByRole("link", { name: /Campaign Deal #123/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", "/dashboard/deals/deal-123");
    });

    it("passes axe accessibility checks", async () => {
      const { container } = renderWithProviders(
        <ListItem
          as="div"
          title="Accessible List Item"
          subtitle="Metadata description"
        />
      );
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });
});
